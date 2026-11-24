const THREADTIME =
  /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEAF])\s+([^:]+):\s*(.*)$/
const URL_PATTERN = /\bhttps?:\/\/[^\s"'<>]+/gi

self.onmessage = async ({ data }) => {
  if (data.type !== 'parse') return

  const { file, fileIndex, fileName, rules } = data
  try {
    const events = await parseFile(file, fileIndex, fileName, rules || {})
    self.postMessage({
      type: 'done',
      fileIndex,
      fileName,
      totalBytes: file.size,
      lines: events.lineCount,
      events: events.detected,
      insights: events.insights,
    })
  } catch (error) {
    self.postMessage({
      type: 'error',
      fileIndex,
      fileName,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

async function parseFile(file, fileIndex, fileName, rules) {
  const detected = []
  const decoder = new TextDecoder()
  const reader = file.stream().getReader()
  let remainder = ''
  let lineCount = 0
  let loadedBytes = 0
  let pending = null
  let lastProgressAt = 0
  const stats = {
    pids: new Map(),
    tags: new Map(),
    priorities: new Map(),
    networkEvidence: [],
    sensitiveFindings: [],
    unparsedLines: 0,
    networkCount: 0,
    sensitiveCount: 0,
  }
  const customTags = new Set((rules.tags || []).map((tag) => tag.trim()).filter(Boolean))
  const customRegexes = (rules.regexRules || []).flatMap((rule) => {
    try {
      const flags = [...new Set((rule.flags || 'i').replace(/[^dgimsuvy]/g, '').replace(/[gy]/g, ''))].join('')
      return [{ rule, regex: new RegExp(rule.pattern, flags || 'i') }]
    } catch {
      return []
    }
  })

  const reportProgress = (force = false) => {
    if (!force && loadedBytes - lastProgressAt < 1024 * 1024) return
    lastProgressAt = loadedBytes
    self.postMessage({
      type: 'progress',
      fileIndex,
      fileName,
      loadedBytes,
      totalBytes: file.size,
      lines: lineCount,
    })
  }

  const flushPending = () => {
    if (!pending) return
    pending.stackTrace = pending.lines.join('\n')
    pending.signatureHash = signatureFor(pending)
    detected.push(pending)
    pending = null
  }

  const addLine = (line) => {
    lineCount += 1
    const match = THREADTIME.exec(line)
    if (!match) {
      if (line.trim()) stats.unparsedLines += 1
      if (pending && isContinuation(pending.category, line, pending.pid)) pending.lines.push(line.trimEnd())
      return
    }

    const [, timestamp, pid, tid, priority, tagValue, message] = match
    const entry = {
      timestamp,
      pid,
      tid,
      priority,
      tag: tagValue.trim(),
      message,
      raw: line,
    }
    recordLineStats(entry, stats)

    if (pending && pending.pid === pid && isContinuation(pending.category, message, pid, entry.tag)) {
      pending.lines.push(line)
      updateTitle(pending, message)
      return
    }
    flushPending()

    const category = detectCategory(entry, customTags, customRegexes)
    if (!category) return

    const customRule = category === 'CUSTOM_APP_TAG'
      ? matchingCustomRule(entry, customTags, customRegexes)
      : null
    pending = {
      category,
      title: titleFor(category, entry, customRule),
      tag: entry.tag,
      severity: severityFor(category, priority),
      timestamp: entry.timestamp,
      pid,
      fileName,
      lines: [line],
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      loadedBytes += value.byteLength
      remainder += decoder.decode(value, { stream: true })
      const lines = remainder.split(/\r?\n/)
      remainder = lines.pop() || ''
      for (const line of lines) addLine(line)
      reportProgress()
    }
    remainder += decoder.decode()
    if (remainder) addLine(remainder)
    flushPending()
    reportProgress(true)
  } finally {
    reader.releaseLock()
  }

  return { detected, lineCount, insights: finishStats(stats) }
}

function recordLineStats(entry, stats) {
  const process = stats.pids.get(entry.pid) || { lines: 0, names: new Set(), tags: new Map() }
  process.lines += 1
  process.tags.set(entry.tag, (process.tags.get(entry.tag) || 0) + 1)
  stats.pids.set(entry.pid, process)
  stats.tags.set(entry.tag, (stats.tags.get(entry.tag) || 0) + 1)
  stats.priorities.set(entry.priority, (stats.priorities.get(entry.priority) || 0) + 1)

  const name = processNameFromMessage(entry.message)
  if (name) {
    const namedProcess = stats.pids.get(name.pid) || { lines: 0, names: new Set(), tags: new Map() }
    namedProcess.names.add(name.name)
    stats.pids.set(name.pid, namedProcess)
  }

  URL_PATTERN.lastIndex = 0
  const urls = [...entry.message.matchAll(URL_PATTERN)].map((match) => cleanEndpoint(match[0]))
  const networkKeyword = /\b(?:okhttp|retrofit|cronet|volley|httpurlconnection|socket|dns|upload|download|network request)\b/i.test(entry.message)
  const method = entry.message.match(/\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/i)?.[1]?.toUpperCase() || ''
  if (urls.length || networkKeyword || method) {
    stats.networkCount += 1
    if (stats.networkEvidence.length < 100) {
      stats.networkEvidence.push({
        timestamp: entry.timestamp,
        pid: entry.pid,
        tag: entry.tag,
        method,
        endpoints: urls,
        direction: /^(POST|PUT|PATCH)$/.test(method) || /\b(?:upload|sending|request body)\b/i.test(entry.message)
          ? 'Possible outbound activity'
          : 'Network-related log',
        sample: redactSensitive(entry.message).slice(0, 260),
      })
    }
  }

  const findingKinds = sensitiveValueKinds(entry.message)
  stats.sensitiveCount += findingKinds.length
  findingKinds.forEach((kind) => {
    if (stats.sensitiveFindings.length >= 50) return
    stats.sensitiveFindings.push({
      kind,
      timestamp: entry.timestamp,
      pid: entry.pid,
      tag: entry.tag,
      sample: redactSensitive(entry.message).slice(0, 260),
    })
  })
}

function processNameFromMessage(message) {
  const matchers = [
    /Start proc\s+(\d+):([^\s/]+)/i,
    /Process:\s*([^,\s]+),\s*PID:\s*(\d+)/i,
    /Process\s+([^\s(]+)\s+\(pid\s+(\d+)\)/i,
    /start(?:ing)?\s+process\s+([^\s,]+)\s+(?:for|pid)\s+(\d+)/i,
  ]
  for (const [index, pattern] of matchers.entries()) {
    const match = message.match(pattern)
    if (match) return index === 0 ? { pid: match[1], name: match[2] } : { pid: match[2], name: match[1] }
  }
  return null
}

function cleanEndpoint(value) {
  try {
    const url = new URL(value.replace(/[),.;]+$/, ''))
    return `${url.origin}${url.pathname}`.slice(0, 180)
  } catch {
    return value.split(/[?#]/)[0].slice(0, 180)
  }
}

function sensitiveValueKinds(message) {
  const findings = []
  if (/\b(?:authorization:\s*bearer|(?:access[_-]?token|refresh[_-]?token|token|api[_-]?key|client[_-]?secret|password|secret)\s*[=:]\s*)\S+/i.test(message) ||
      /["']?(?:access[_-]?token|refresh[_-]?token|token|api[_-]?key|client[_-]?secret|password|secret)["']?\s*:\s*["'][^"']+/i.test(message)) {
    findings.push('Possible credential or token')
  }
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(message)) findings.push('Email address')
  if (/\b(?:\d[ -]?){9,15}\b/.test(message)) findings.push('Possible phone or numeric identifier')
  if (/\b(?:lat(?:itude)?\s*[=:]\s*-?\d{1,2}\.\d+.*lon(?:gitude)?\s*[=:]\s*-?\d{1,3}\.\d+|lon(?:gitude)?\s*[=:]\s*-?\d{1,3}\.\d+.*lat(?:itude)?\s*[=:]\s*-?\d{1,2}\.\d+)/i.test(message)) {
    findings.push('Possible location coordinates')
  }
  if (/\b(?:android[_ -]?id|imei|mac(?: address)?)\s*[=:]\s*[0-9a-f:-]{6,}/i.test(message)) {
    findings.push('Device identifier')
  }
  return findings
}

function redactSensitive(message) {
  return message
    .replace(/(authorization:\s*bearer\s+)\S+/gi, '$1[redacted]')
    .replace(/\b((?:access[_-]?token|refresh[_-]?token|token|api[_-]?key|client[_-]?secret|password)\s*[=:]\s*)\S+/gi, '$1[redacted]')
    .replace(/(["']?(?:access[_-]?token|refresh[_-]?token|token|api[_-]?key|client[_-]?secret|password|secret)["']?\s*:\s*["'])[^"']+/gi, '$1[redacted]')
    .replace(/([?&](?:access[_-]?token|refresh[_-]?token|token|api[_-]?key|password|secret)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email redacted]')
    .replace(/\b(?:android[_ -]?id|imei|mac(?: address)?)\s*[=:]\s*[0-9a-f:-]{6,}/gi, '[device identifier redacted]')
    .replace(/\b((?:lat(?:itude)?|lon(?:gitude)?)\s*[=:]\s*)-?\d{1,3}\.\d+/gi, '$1[coordinate redacted]')
    .replace(/\b(?:\d[ -]?){9,15}\b/g, '[number redacted]')
}

function finishStats(stats) {
  const processes = [...stats.pids.entries()].map(([pid, process]) => ({
    pid,
    names: [...process.names],
    lines: process.lines,
    tags: [...process.tags.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  }))
  return {
    processes,
    tags: [...stats.tags.entries()].map(([tag, count]) => ({ tag, count })),
    priorities: Object.fromEntries(stats.priorities),
    networkEvidence: stats.networkEvidence,
    sensitiveFindings: stats.sensitiveFindings,
    unparsedLines: stats.unparsedLines,
    networkCount: stats.networkCount,
    sensitiveCount: stats.sensitiveCount,
  }
}

function detectCategory(entry, customTags, customRegexes) {
  const { message, tag } = entry
  const lowerMessage = message.toLowerCase()
  if (message.includes('FATAL EXCEPTION:')) return 'JAVA_CRASH'
  if (message.startsWith('ANR in ') || message.includes('Input dispatching timed out')) return 'ANR'
  if (message.includes('*** *** *** *** ***')) return 'NATIVE_TOMBSTONE'
  if (
    lowerMessage.includes('lowmemorykiller') ||
    lowerMessage.includes('avc: denied') ||
    tag === 'Watchdog' ||
    (tag.toLowerCase().includes('thermalengine') && /\berror\b/i.test(message)) ||
    message.includes('OutOfMemoryError') ||
    message.includes('StrictMode') ||
    lowerMessage.includes('oom_adj')
  ) return 'SYSTEM_KERNEL_HW'
  if (customTags.has(tag) || customRegexes.some(({ regex }) => testRegex(regex, message))) {
    return 'CUSTOM_APP_TAG'
  }
  return null
}

function matchingCustomRule(entry, customTags, customRegexes) {
  if (customTags.has(entry.tag)) return { name: entry.tag }
  const match = customRegexes.find(({ regex }) => testRegex(regex, entry.message))
  return match?.rule || null
}

function testRegex(regex, value) {
  regex.lastIndex = 0
  return regex.test(value)
}

function isContinuation(category, value, pid, tag = '') {
  if (category === 'JAVA_CRASH') {
    return /^\s*(?:at\s|Caused by:|Suppressed:|Process:|... \d+ more)/.test(value) ||
      /^\s*[\w.$]+(?:Exception|Error)(?::|$)/.test(value) ||
      /^\s*RuntimeException(?::|$)/.test(value)
  }
  if (category === 'ANR') {
    return /(?:Reason:|Load:|CPU usage from|CPU usage|Cmd line:|DALVIK THREADS|sysTid=)/i.test(value) ||
      /^\s*(?:\d+%|TOTAL:|\/system\/|\/vendor\/)/.test(value)
  }
  if (category === 'NATIVE_TOMBSTONE') {
    return /^(?:DEBUG|libc)$/i.test(tag) ||
      /(?:signal\s+\d+\s+\(|SIG(?:SEGV|ABRT|BUS|ILL|FPE)|fault addr|backtrace:|#\d+\s+pc\s|Abort message:)/i.test(value)
  }
  return false
}

function updateTitle(event, message) {
  const value = message.trim()
  if (event.category === 'JAVA_CRASH' && /(?:Exception|Error)(?::|$)/.test(value)) {
    event.title = value.replace(/^\s*/, '').slice(0, 180)
  } else if (event.category === 'NATIVE_TOMBSTONE' && /SIG(?:SEGV|ABRT|BUS|ILL|FPE)|signal\s+\d+\s+\(/i.test(value)) {
    event.title = value.slice(0, 180)
  } else if (event.category === 'ANR' && value.startsWith('ANR in ')) {
    event.title = value.slice(0, 180)
  }
}

function titleFor(category, entry, customRule) {
  if (category === 'JAVA_CRASH') return 'FATAL EXCEPTION'
  if (category === 'ANR') return entry.message.slice(0, 180)
  if (category === 'NATIVE_TOMBSTONE') return 'Native tombstone'
  if (category === 'SYSTEM_KERNEL_HW') return entry.message.slice(0, 180)
  return customRule?.name || entry.tag || 'Custom match'
}

function severityFor(category, priority) {
  if (category === 'JAVA_CRASH' || category === 'NATIVE_TOMBSTONE') return 'Fatal'
  if (category === 'ANR' || priority === 'E' || priority === 'A') return 'Error'
  if (category === 'SYSTEM_KERNEL_HW') return 'Warning'
  return 'Notice'
}

function signatureFor(event) {
  const normalizedTitle = normalize(event.title)
  const frames = event.lines
    .filter((line) => /(?:^\s*at\s|#\d+\s+pc\s|backtrace:)/i.test(line))
    .slice(0, 3)
    .map(normalize)
  const source = [event.category, normalizedTitle, ...frames].join('|')
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function normalize(value) {
  return value
    .replace(/0x[0-9a-f]+/gi, '<addr>')
    .replace(/\b(pid|tid|uid)[=: ]+\d+\b/gi, '$1=<id>')
    .replace(/\b\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}\b/g, '<time>')
    .replace(/\b\d+\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
}

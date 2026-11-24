const THREADTIME =
  /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEAF])\s+([^:]+):\s*(.*)$/
const PAGE_SIZE = 200
const MAX_CACHED_PAGES = 5
let active = null

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'open') {
      if (active) await active.reader.cancel()
      active = createSession(data.file, data.fileName)
      self.postMessage({ type: 'opened', fileName: data.fileName })
      await sendPage(1)
    } else if (data.type === 'next') {
      await sendPage(active.nextPage)
    } else if (data.type === 'page') {
      await sendPage(data.page)
    } else if (data.type === 'search') {
      await searchFile(data.query)
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

function createSession(file, fileName) {
  return {
    file,
    fileName,
    reader: file.stream().getReader(),
    decoder: new TextDecoder(),
    remainder: '',
    lineNumber: 0,
    ended: false,
    lookahead: null,
    nextPage: 1,
    pages: new Map(),
  }
}

async function sendPage(pageNumber) {
  if (!active) return
  if (active.pages.has(pageNumber)) {
    const cachedPage = active.pages.get(pageNumber)
    self.postMessage({ type: 'page', page: pageNumber, rows: cachedPage.rows, hasNext: cachedPage.hasNext, oldestPage: Math.min(...active.pages.keys()) })
    return
  }
  if (pageNumber !== active.nextPage) {
    self.postMessage({ type: 'error', message: 'That page is no longer cached. Use the previous and next controls.' })
    return
  }

  const rows = []
  while (rows.length < PAGE_SIZE) {
    const item = await nextLine(active)
    if (!item) break
    rows.push(parseLine(item.line, item.lineNumber))
  }
  let hasNext = false
  if (rows.length === PAGE_SIZE) {
    active.lookahead = await nextLine(active)
    hasNext = Boolean(active.lookahead)
  }
  active.pages.set(pageNumber, { rows, hasNext })
  active.nextPage += 1
  while (active.pages.size > MAX_CACHED_PAGES) {
    const oldest = Math.min(...active.pages.keys())
    active.pages.delete(oldest)
  }
  self.postMessage({ type: 'page', page: pageNumber, rows, hasNext, oldestPage: Math.min(...active.pages.keys()) })
}

async function nextLine(session) {
  if (session.lookahead) {
    const item = session.lookahead
    session.lookahead = null
    return item
  }
  while (true) {
    const newlineAt = session.remainder.indexOf('\n')
    if (newlineAt >= 0) {
      let line = session.remainder.slice(0, newlineAt)
      session.remainder = session.remainder.slice(newlineAt + 1)
      if (line.endsWith('\r')) line = line.slice(0, -1)
      session.lineNumber += 1
      return { line, lineNumber: session.lineNumber }
    }
    if (session.ended) {
      if (!session.remainder.length) return null
      const line = session.remainder
      session.remainder = ''
      session.lineNumber += 1
      return { line, lineNumber: session.lineNumber }
    }
    const { value, done } = await session.reader.read()
    if (done) {
      session.remainder += session.decoder.decode()
      session.ended = true
    } else {
      session.remainder += session.decoder.decode(value, { stream: true })
    }
  }
}

function parseLine(raw, lineNumber) {
  const match = THREADTIME.exec(raw)
  if (!match) {
    return {
      lineNumber,
      format: raw.trim() ? 'continuation' : 'blank',
      timestamp: '',
      pid: '',
      tid: '',
      priority: '',
      tag: '',
      message: raw,
      raw,
    }
  }
  const [, timestamp, pid, tid, priority, tag, message] = match
  return { lineNumber, format: 'threadtime', timestamp, pid, tid, priority, tag: tag.trim(), message, raw }
}

async function searchFile(query) {
  if (!active || !query.trim()) {
    self.postMessage({ type: 'search-done', rows: [], totalMatches: 0 })
    return
  }
  const file = active.file
  const reader = file.stream().getReader()
  const decoder = new TextDecoder()
  const needle = query.trim().toLocaleLowerCase()
  let remainder = ''
  let lineNumber = 0
  let loadedBytes = 0
  let totalMatches = 0
  const rows = []

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      loadedBytes += value.byteLength
      remainder += decoder.decode(value, { stream: true })
      const lines = remainder.split(/\r?\n/)
      remainder = lines.pop() || ''
      for (const line of lines) {
        lineNumber += 1
        if (line.toLocaleLowerCase().includes(needle)) {
          totalMatches += 1
          if (rows.length < 300) rows.push(parseLine(line, lineNumber))
        }
      }
      if (loadedBytes % (4 * 1024 * 1024) < value.byteLength) {
        self.postMessage({ type: 'search-progress', loadedBytes, totalBytes: file.size })
      }
    }
    remainder += decoder.decode()
    if (remainder) {
      lineNumber += 1
      if (remainder.toLocaleLowerCase().includes(needle)) {
        totalMatches += 1
        if (rows.length < 300) rows.push(parseLine(remainder, lineNumber))
      }
    }
    self.postMessage({ type: 'search-done', rows, totalMatches })
  } finally {
    reader.releaseLock()
  }
}

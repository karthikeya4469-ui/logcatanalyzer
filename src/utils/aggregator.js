export function aggregateResults(files, perFileEvents) {
  const issuesBySignature = new Map()
  const processesByName = new Map()
  const tagsByName = new Map()
  const priorities = {}
  const networkEvidence = []
  const sensitiveFindings = []
  let totalLines = 0
  let totalEvents = 0
  let unparsedLines = 0
  let networkEvidenceCount = 0
  let sensitiveFindingCount = 0

  files.forEach((file, index) => {
    const result = perFileEvents[index] || {}
    const events = result.events || []
    const insights = result.insights || {}
    totalLines += result.lines || 0
    totalEvents += events.length
    unparsedLines += insights.unparsedLines || 0
    networkEvidenceCount += insights.networkCount || 0
    sensitiveFindingCount += insights.sensitiveCount || 0
    Object.entries(insights.priorities || {}).forEach(([priority, count]) => {
      priorities[priority] = (priorities[priority] || 0) + count
    })
    ;(insights.tags || []).forEach(({ tag, count }) => {
      tagsByName.set(tag, (tagsByName.get(tag) || 0) + count)
    })
    ;(insights.processes || []).forEach((process) => {
      const name = process.names[0] || `Unknown process (PID ${process.pid})`
      const key = process.names[0] || `pid:${process.pid}`
      const item = processesByName.get(key) || {
        name,
        pids: new Set(),
        lines: 0,
        files: new Set(),
        tags: new Map(),
      }
      item.pids.add(process.pid)
      item.lines += process.lines
      item.files.add(file.webkitRelativePath || file.name)
      process.tags.forEach(({ tag, count }) => item.tags.set(tag, (item.tags.get(tag) || 0) + count))
      processesByName.set(key, item)
    })
    ;(insights.networkEvidence || []).forEach((item) => {
      if (networkEvidence.length < 200) networkEvidence.push({ ...item, fileName: file.webkitRelativePath || file.name })
    })
    ;(insights.sensitiveFindings || []).forEach((item) => {
      if (sensitiveFindings.length < 200) sensitiveFindings.push({ ...item, fileName: file.webkitRelativePath || file.name })
    })
    events.forEach((event) => {
      let issue = issuesBySignature.get(event.signatureHash)
      if (!issue) {
        issue = {
          ...event,
          occurrences: 0,
          files: new Set(),
          firstSeen: event.timestamp,
          lastSeen: event.timestamp,
          seenAt: [],
          traces: [],
        }
        issuesBySignature.set(event.signatureHash, issue)
      }
      issue.occurrences += 1
      issue.files.add(event.fileName)
      if (event.timestamp < issue.firstSeen) issue.firstSeen = event.timestamp
      if (event.timestamp > issue.lastSeen) issue.lastSeen = event.timestamp
      issue.seenAt.push(event.timestamp)
      if (event.stackTrace && !issue.traces.includes(event.stackTrace)) issue.traces.push(event.stackTrace)
    })
  })

  const issues = [...issuesBySignature.values()]
    .map((issue) => ({
      ...issue,
      files: [...issue.files].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => b.occurrences - a.occurrences || a.title.localeCompare(b.title))

  const processes = [...processesByName.values()]
    .map((process) => ({
      ...process,
      pids: [...process.pids].sort((a, b) => Number(a) - Number(b)),
      files: [...process.files].sort((a, b) => a.localeCompare(b)),
      tags: [...process.tags.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    }))
    .sort((a, b) => b.lines - a.lines)

  return {
    issues,
    totalLines,
    totalEvents,
    totalFiles: files.length,
    unparsedLines,
    priorities,
    tags: [...tagsByName.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count),
    processes,
    networkEvidence,
    sensitiveFindings,
    networkEvidenceCount,
    sensitiveFindingCount,
  }
}

export function buildSummary(data) {
  const count = (category) =>
    data.issues
      .filter((issue) => issue.category === category)
      .reduce((sum, issue) => sum + issue.occurrences, 0)
  return {
    totalFiles: data.totalFiles,
    totalLines: data.totalLines,
    totalEvents: data.totalEvents,
    uniqueCrashes: data.issues.filter((issue) => issue.category === 'JAVA_CRASH').length,
    totalCrashes: count('JAVA_CRASH'),
    anrs: count('ANR'),
    tombstones: count('NATIVE_TOMBSTONE'),
    systemAlerts: count('SYSTEM_KERNEL_HW'),
    customMatches: count('CUSTOM_APP_TAG'),
  }
}

export function buildTimeline(issues) {
  const buckets = new Map()
  issues.forEach((issue) => {
    issue.seenAt.forEach((value) => {
      const timestamp = value.match(/^(\d{2}-\d{2}\s+\d{2}:\d{2})/)?.[1]
      if (!timestamp) return
      const [date, time] = timestamp.split(/\s+/)
      const key = `${date} ${time.slice(0, 2)}:00`
      const bucket = buckets.get(key) || { time: key, JAVA_CRASH: 0, ANR: 0, NATIVE_TOMBSTONE: 0, SYSTEM_KERNEL_HW: 0, CUSTOM_APP_TAG: 0 }
      bucket[issue.category] += 1
      buckets.set(key, bucket)
    })
  })
  return [...buckets.values()].sort((a, b) => a.time.localeCompare(b.time))
}

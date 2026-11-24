const MAX_WORKERS = 8

export function parseFilesWithWorkers(files, rules, onProgress) {
  if (!files.length) return Promise.resolve([])

  const hardwareThreads = Number(globalThis.navigator?.hardwareConcurrency) || 2
  const workerCount = Math.min(files.length, MAX_WORKERS, Math.max(1, hardwareThreads))
  const workers = Array.from(
    { length: workerCount },
    () => new Worker(new URL('../workers/logParser.worker.js', import.meta.url), { type: 'module' }),
  )

  return new Promise((resolve, reject) => {
    const results = []
    let nextIndex = 0
    let completed = 0
    let settled = false

    const finish = (error) => {
      if (settled) return
      settled = true
      workers.forEach((worker) => worker.terminate())
      if (error) reject(error)
      else resolve(results)
    }

    const assignNext = (worker) => {
      if (nextIndex >= files.length) return
      const fileIndex = nextIndex++
      const file = files[fileIndex]
      worker.postMessage({
        type: 'parse',
        fileIndex,
        file,
        fileName: file.webkitRelativePath || file.name,
        rules,
      })
    }

    workers.forEach((worker) => {
      worker.onmessage = ({ data }) => {
        if (data.type === 'progress') {
          onProgress({
            fileIndex: data.fileIndex,
            fileName: data.fileName,
            loadedBytes: data.loadedBytes,
            totalBytes: data.totalBytes,
            lines: data.lines,
            completedFiles: completed,
            totalFiles: files.length,
          })
          return
        }

        if (data.type === 'error') {
          finish(new Error(`${data.fileName}: ${data.message}`))
          return
        }

        if (data.type === 'done') {
          results[data.fileIndex] = {
            events: data.events,
            lines: data.lines,
            insights: data.insights,
          }
          completed += 1
          onProgress({
            fileIndex: data.fileIndex,
            fileName: data.fileName,
            loadedBytes: data.totalBytes,
            totalBytes: data.totalBytes,
            lines: data.lines,
            completedFiles: completed,
            totalFiles: files.length,
            done: true,
          })
          if (completed === files.length) finish()
          else assignNext(worker)
        }
      }

      worker.onerror = (event) => {
        finish(event.error || new Error(event.message || 'A log parser worker failed.'))
      }

      assignNext(worker)
    })
  })
}

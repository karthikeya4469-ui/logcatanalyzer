import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, BookOpen, ChevronLeft, ChevronRight, Search } from 'lucide-react'

const PRIORITIES = {
  V: ['Verbose', 'Very detailed diagnostic output.'],
  D: ['Debug', 'Developer diagnostics used while investigating behavior.'],
  I: ['Info', 'General operational information.'],
  W: ['Warning', 'Something unexpected that may need attention.'],
  E: ['Error', 'An operation failed or encountered a problem.'],
  F: ['Fatal', 'A fatal condition, often immediately before a process crash.'],
  A: ['Assert', 'An assertion failure emitted by Android logging.'],
}

const PRIORITY_STYLE = {
  V: 'text-slate-400',
  D: 'text-sky-300',
  I: 'text-emerald-300',
  W: 'text-amber-300',
  E: 'text-rose-300',
  F: 'text-rose-200',
  A: 'text-fuchsia-300',
}

export default function LogExplorer({ files, processes = [] }) {
  const [fileIndex, setFileIndex] = useState(0)
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [oldestPage, setOldestPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchProgress, setSearchProgress] = useState(null)
  const [error, setError] = useState('')
  const workerRef = useRef(null)
  const file = files[fileIndex]

  const processNames = useMemo(() => {
    const lookup = new Map()
    processes.forEach((process) => process.pids.forEach((pid) => lookup.set(String(pid), process.name)))
    return lookup
  }, [processes])

  useEffect(() => {
    if (!file) return undefined
    const worker = new Worker(new URL('../workers/logFileExplorer.worker.js', import.meta.url), { type: 'module' })
    workerRef.current = worker
    const fileName = file.webkitRelativePath || file.name
    setRows([])
    setPage(1)
    setOldestPage(1)
    setSelected(null)
    setSearchResults(null)
    setSearching(false)
    setSearchProgress(null)
    setHasNext(false)
    setLoading(true)
    setError('')
    worker.onmessage = ({ data }) => {
      if (data.type === 'opened') return
      if (data.type === 'page') {
        setRows(data.rows)
        setPage(data.page)
        setOldestPage(data.oldestPage)
        setHasNext(data.hasNext)
        setSelected(null)
        setLoading(false)
        return
      }
      if (data.type === 'search-progress') {
        setSearchProgress(data)
        return
      }
      if (data.type === 'search-done') {
        setSearchResults(data)
        setSearching(false)
        setSearchProgress(null)
        return
      }
      if (data.type === 'error') {
        setError(data.message)
        setLoading(false)
        setSearching(false)
      }
    }
    worker.onerror = (event) => {
      setError(event.message || 'The log viewer worker failed.')
      setLoading(false)
      setSearching(false)
    }
    worker.postMessage({ type: 'open', file, fileName })
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [file])

  const runSearch = () => {
    const worker = workerRef.current
    if (!worker || !query.trim()) return
    setSearchResults(null)
    setSelected(null)
    setSearching(true)
    setSearchProgress({ loadedBytes: 0, totalBytes: file.size })
    worker.postMessage({ type: 'search', query })
  }

  if (!files.length) {
    return <EmptyPanel text="Choose log files to inspect every line and its parsed fields." />
  }

  const currentRows = searchResults ? searchResults.rows : rows
  const currentPageLabel = searchResults ? `${searchResults.totalMatches.toLocaleString()} search matches` : `Page ${page}`

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-panel p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-100">Explore every line</h2>
            <p className="mt-1 text-xs leading-5 text-muted">The file is streamed in a web worker. Rows are read on demand, not all loaded into memory.</p>
          </div>
          <select value={fileIndex} onChange={(event) => { setFileIndex(Number(event.target.value)); setSearchResults(null) }} className="max-w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500 md:w-80">
            {files.map((entry, index) => <option key={`${entry.name}-${index}`} value={index}>{entry.webkitRelativePath || entry.name}</option>)}
          </select>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && runSearch()} placeholder="Search the whole file (runs locally)..." className="w-full rounded-lg border border-line bg-canvas py-2 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-slate-500" />
          </div>
          <button type="button" onClick={runSearch} disabled={searching || !query.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-40"><Search className="h-3.5 w-3.5" /> Search file</button>
          {searchResults && <button type="button" onClick={() => { setSearchResults(null); setQuery('') }} className="rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-slate-200">Clear search</button>}
        </div>
        {searching && (
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
            <span>Searching entire file in the background…</span>
            <span className="font-mono">{searchProgress?.totalBytes ? Math.round((searchProgress.loadedBytes / searchProgress.totalBytes) * 100) : 0}%</span>
          </div>
        )}
        {searchResults && <p className="mt-3 text-[11px] text-slate-400">{searchResults.totalMatches.toLocaleString()} matching lines found. Showing up to {searchResults.rows.length} results.</p>}
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div><h3 className="text-xs font-semibold text-slate-200">{file.webkitRelativePath || file.name}</h3><p className="mt-1 text-[10px] text-muted">{currentPageLabel} · {currentRows.length} visible lines</p></div>
          {!searchResults && (
            <div className="flex gap-1">
              <button type="button" aria-label="Previous page" disabled={loading || page <= oldestPage} onClick={() => { setLoading(true); workerRef.current?.postMessage({ type: 'page', page: page - 1 }) }} className="rounded-md border border-line p-1.5 text-slate-400 hover:bg-white/5 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" aria-label="Next page" disabled={loading || !hasNext} onClick={() => { setLoading(true); workerRef.current?.postMessage({ type: 'page', page: page + 1 }) }} className="rounded-md border border-line p-1.5 text-slate-400 hover:bg-white/5 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
        </div>
        {error && <div role="alert" className="m-4 flex items-center gap-2 rounded-lg border border-rose-400/20 bg-rose-400/5 p-3 text-xs text-rose-300"><AlertCircle className="h-4 w-4" /> {error}</div>}
        {loading ? <div className="p-12 text-center text-xs text-muted">Reading lines in a background worker…</div> : (
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[950px] border-collapse text-left font-mono text-[11px]">
              <thead className="sticky top-0 z-10 bg-[#121a26] text-[10px] uppercase tracking-wider text-slate-500">
                <tr><th className="px-3 py-2">Line</th><th className="px-3 py-2">Timestamp</th><th className="px-3 py-2">PID / process</th><th className="px-3 py-2">TID</th><th className="px-3 py-2">Level</th><th className="px-3 py-2">Tag</th><th className="px-3 py-2">Message</th></tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {currentRows.map((row) => (
                  <tr key={row.lineNumber} onClick={() => setSelected(row)} className={`cursor-pointer align-top hover:bg-white/[0.03] ${selected?.lineNumber === row.lineNumber ? 'bg-accent/[0.04]' : ''}`}>
                    <td className="px-3 py-2 text-slate-600">{row.lineNumber}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-400">{row.timestamp || '—'}</td>
                    <td className="px-3 py-2 text-slate-300"><span>{row.pid || '—'}</span>{row.pid && processNames.has(row.pid) && <span className="ml-1 text-[10px] text-accent">{processNames.get(row.pid)}</span>}</td>
                    <td className="px-3 py-2 text-slate-500">{row.tid || '—'}</td>
                    <td className={`px-3 py-2 font-semibold ${PRIORITY_STYLE[row.priority] || 'text-slate-600'}`}>{row.priority || '—'}</td>
                    <td className="max-w-40 truncate px-3 py-2 text-sky-200/80">{row.tag || '—'}</td>
                    <td className="max-w-[550px] whitespace-pre-wrap break-all px-3 py-2 text-slate-300">{row.message || ' '}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!currentRows.length && !error && <div className="p-12 text-center text-xs text-slate-500">{searchResults ? 'No matching lines.' : 'This file is empty.'}</div>}
          </div>
        )}
      </section>

      {selected && <LineDetails row={selected} processName={processNames.get(selected.pid)} />}
      <FieldGlossary />
    </div>
  )
}

function LineDetails({ row, processName }) {
  const priority = PRIORITIES[row.priority]
  return (
    <section className="rounded-xl border border-accent/20 bg-[#0f1a20] p-4 sm:p-5">
      <div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-accent" /><h3 className="text-sm font-semibold text-slate-100">What this line tells you</h3></div>
      <p className="mt-2 break-all rounded-lg border border-line bg-canvas p-3 font-mono text-[11px] leading-5 text-slate-300">{row.raw || '(empty line)'}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Meaning label="Timestamp" value={row.timestamp || 'Not a threadtime record'} explanation="When Android wrote the message. Threadtime normally omits year and timezone." />
        <Meaning label="PID" value={row.pid || 'Not present'} explanation={processName ? `Process ID; matched from process-start logs to ${processName}.` : 'Process ID. It identifies a running process, not its name; this log did not provide a reliable name mapping.'} />
        <Meaning label="TID" value={row.tid || 'Not present'} explanation="Thread ID inside the process. One process can have many threads." />
        <Meaning label="Priority" value={row.priority ? `${row.priority} · ${priority?.[0] || 'Unknown'}` : 'Not present'} explanation={priority?.[1] || 'The record is not in standard Android threadtime format.'} />
        <Meaning label="Tag" value={row.tag || 'Not present'} explanation="A label chosen by the code that wrote the message. It often hints at the Android component or library, but does not prove which code executed." />
        <Meaning label="Message" value={row.message || 'No message'} explanation="The actual log text. It may include diagnostic details, errors, URLs, identifiers, or sensitive values." />
      </div>
      <p className="mt-4 border-t border-line pt-3 text-[11px] leading-5 text-slate-400">
        A log line is evidence of what was logged, not a complete record of everything the process did. Missing lines can be filtered, unavailable, or omitted by the app/system.
      </p>
    </section>
  )
}

function Meaning({ label, value, explanation }) {
  return <div className="rounded-lg border border-line bg-panel p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-accent">{label}</p><p className="mt-1 break-words font-mono text-xs text-slate-200">{value}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{explanation}</p></div>
}

function FieldGlossary() {
  return (
    <details className="rounded-xl border border-line bg-panel p-4">
      <summary className="cursor-pointer list-none text-xs font-semibold text-slate-300"><span className="mr-2 text-accent">?</span>Learn the Android logcat fields</summary>
      <div className="mt-4 grid gap-3 text-xs leading-5 text-slate-400 sm:grid-cols-2 lg:grid-cols-3">
        <p><b className="text-slate-200">Timestamp</b> — date and time the logger recorded the line. Threadtime often has no year or timezone.</p>
        <p><b className="text-slate-200">PID</b> — process identifier. Android assigns it while a process runs; the number can later be reused.</p>
        <p><b className="text-slate-200">TID</b> — thread identifier within that process. Useful for following a thread’s work.</p>
        <p><b className="text-slate-200">Priority</b> — V verbose, D debug, I info, W warning, E error, F fatal, A assert.</p>
        <p><b className="text-slate-200">Tag</b> — source label supplied by the logging code. A tag is a clue, not always an exact class or library name.</p>
        <p><b className="text-slate-200">Message</b> — text emitted by the process. It may be truncated, redacted, or contain private data.</p>
      </div>
    </details>
  )
}

function EmptyPanel({ text }) {
  return <div className="rounded-xl border border-dashed border-line bg-panel p-12 text-center text-sm text-slate-500">{text}</div>
}

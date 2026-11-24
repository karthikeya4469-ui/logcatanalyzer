import { useMemo, useState } from 'react'
import { Activity, Braces, Github, ShieldCheck, TerminalSquare } from 'lucide-react'
import FolderUploader from './components/FolderUploader.jsx'
import IssueTable from './components/IssueTable.jsx'
import RuleManagerModal from './components/RuleManagerModal.jsx'
import StackTraceDrawer from './components/StackTraceDrawer.jsx'
import SummaryCards from './components/SummaryCards.jsx'
import TimelineChart from './components/TimelineChart.jsx'
import LogExplorer from './components/LogExplorer.jsx'
import DataInsights from './components/DataInsights.jsx'
import { aggregateResults, buildSummary, buildTimeline } from './utils/aggregator.js'
import { loadRules } from './utils/defaultRules.js'
import { parseFilesWithWorkers } from './utils/workerPool.js'

const EMPTY_DATA = {
  issues: [],
  totalFiles: 0,
  totalLines: 0,
  totalEvents: 0,
  processes: [],
  tags: [],
  priorities: {},
  networkEvidence: [],
  sensitiveFindings: [],
  networkEvidenceCount: 0,
  sensitiveFindingCount: 0,
  unparsedLines: 0,
}

export default function App() {
  const [data, setData] = useState(EMPTY_DATA)
  const [rules, setRules] = useState(loadRules)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')
  const [selectedIssue, setSelectedIssue] = useState(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const summary = useMemo(() => buildSummary(data), [data])
  const timeline = useMemo(() => buildTimeline(data.issues), [data.issues])
  const totalBytes = useMemo(() => files.reduce((total, file) => total + file.size, 0), [files])

  const analyzeFiles = async (selectedFiles) => {
    setFiles(selectedFiles)
    setData(EMPTY_DATA)
    setError('')
    setBusy(true)
    setProgress({ completedFiles: 0, totalFiles: selectedFiles.length })
    try {
      const results = await parseFilesWithWorkers(selectedFiles, rules, setProgress)
      setData(aggregateResults(selectedFiles, results))
      setProgress((current) => ({ ...current, completedFiles: selectedFiles.length, totalFiles: selectedFiles.length, done: true }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-slate-100">
      <header className="border-b border-line/80 bg-[#0b1119]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent"><TerminalSquare className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-bold tracking-tight text-slate-100">LogScope <span className="font-normal text-slate-500">/ ADB analyzer</span></p>
              <p className="mt-0.5 text-[10px] tracking-wide text-slate-600">DETERMINISTIC · LOCAL-FIRST · ANDROID</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-2.5 py-1 text-[10px] text-emerald-300 sm:inline-flex">
              <ShieldCheck className="h-3 w-3" /> Files never leave this device
            </span>
            <button type="button" onClick={() => setRulesOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:bg-white/[0.03]">
              <Braces className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Custom rules</span><span className="sm:hidden">Rules</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] space-y-6 px-5 py-7 sm:px-8 sm:py-9">
        <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent"><Activity className="h-3.5 w-3.5" /> Log intelligence</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Understand what your logs say</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Explore every line, decode Android log fields, identify observed processes, and review network-related evidence alongside crash analysis.</p>
          </div>
          <div className="hidden items-center gap-2 pb-1 text-[11px] text-slate-500 md:flex"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> Regex &amp; state-machine parsing</div>
        </section>

        <FolderUploader
          onFiles={analyzeFiles}
          progress={progress}
          busy={busy}
          fileCount={files.length}
          totalBytes={totalBytes}
          error={error}
        />

        <nav aria-label="Log analysis views" className="flex flex-wrap gap-2 border-b border-line pb-3">
          {[
            ['overview', 'Crash overview'],
            ['explorer', 'Explore every line'],
            ['insights', 'Processes & data clues'],
          ].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setActiveTab(key)} className={`rounded-lg px-3 py-2 text-xs font-medium transition ${activeTab === key ? 'bg-accent/10 text-accent ring-1 ring-accent/20' : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'}`}>
              {label}
            </button>
          ))}
          {data.totalFiles > 0 && <span className="ml-auto self-center font-mono text-[10px] text-slate-600">CURRENT BATCH · {data.totalFiles.toLocaleString()} FILES</span>}
        </nav>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Crash and system overview</h2>
                <span className="text-[10px] text-slate-500">{data.totalLines.toLocaleString()} lines scanned</span>
              </div>
              <SummaryCards summary={summary} />
            </section>
            <TimelineChart data={timeline} />
            <IssueTable issues={data.issues} onSelect={setSelectedIssue} />
          </div>
        )}

        {activeTab === 'explorer' && <LogExplorer files={files} processes={data.processes} />}
        {activeTab === 'insights' && <DataInsights data={data} />}

        <footer className="flex flex-col gap-2 border-t border-line/70 pt-5 text-[10px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>LogScope runs entirely in your browser. Network indicators are log evidence, not proof of transmission.</span>
          <span className="flex items-center gap-1.5"><Github className="h-3 w-3" /> Deterministic log analysis</span>
        </footer>
      </div>

      <StackTraceDrawer issue={selectedIssue} onClose={() => setSelectedIssue(null)} />
      {rulesOpen && <RuleManagerModal rules={rules} onSave={setRules} onClose={() => setRulesOpen(false)} />}
    </main>
  )
}

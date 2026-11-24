import { Activity, AlertTriangle, Bug, Cpu, FileSearch, ScanLine, ShieldAlert } from 'lucide-react'

const cards = [
  { key: 'files', label: 'Files scanned', detail: 'lines parsed', icon: FileSearch, color: 'text-sky-300', bg: 'bg-sky-400/10' },
  { key: 'crashes', label: 'Java / Kotlin', detail: 'unique / total crashes', icon: Bug, color: 'text-rose-300', bg: 'bg-rose-400/10' },
  { key: 'anrs', label: 'ANRs detected', detail: 'application not responding', icon: AlertTriangle, color: 'text-amber-300', bg: 'bg-amber-400/10' },
  { key: 'native', label: 'Native tombstones', detail: 'C / C++ crashes', icon: Cpu, color: 'text-purple-300', bg: 'bg-purple-400/10' },
  { key: 'system', label: 'System / HW alerts', detail: 'kernel, policy, memory', icon: ShieldAlert, color: 'text-cyan-300', bg: 'bg-cyan-400/10' },
  { key: 'custom', label: 'Custom matches', detail: 'user-defined rules', icon: ScanLine, color: 'text-accent', bg: 'bg-accent/10' },
]

export default function SummaryCards({ summary }) {
  const values = {
    files: [summary.totalFiles.toLocaleString(), `${summary.totalLines.toLocaleString()} lines parsed`],
    crashes: [`${summary.uniqueCrashes.toLocaleString()} / ${summary.totalCrashes.toLocaleString()}`, 'unique / total crashes'],
    anrs: [summary.anrs.toLocaleString(), 'application not responding'],
    native: [summary.tombstones.toLocaleString(), 'C / C++ crashes'],
    system: [summary.systemAlerts.toLocaleString(), 'kernel, policy, memory'],
    custom: [summary.customMatches.toLocaleString(), 'user-defined rules'],
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(({ key, label, icon: Icon, color, bg }) => (
        <article key={key} className="rounded-xl border border-line bg-panel p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted">{label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">{values[key][0]}</p>
            </div>
            <div className={`rounded-lg p-2 ${bg} ${color}`}><Icon className="h-4 w-4" /></div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">{values[key][1]}</p>
        </article>
      ))}
    </div>
  )
}

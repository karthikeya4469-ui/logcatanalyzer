import { useMemo, useState } from 'react'
import { Activity, AlertTriangle, Cpu, EyeOff, Network, ShieldAlert } from 'lucide-react'

export default function DataInsights({ data }) {
  const [selectedProcess, setSelectedProcess] = useState('')
  const processLookup = useMemo(() => {
    const lookup = new Map()
    data.processes.forEach((process) => process.pids.forEach((pid) => lookup.set(String(pid), process.name)))
    return lookup
  }, [data.processes])
  const evidence = selectedProcess
    ? data.networkEvidence.filter((item) => processLookup.get(item.pid) === selectedProcess)
    : data.networkEvidence
  const sensitive = selectedProcess
    ? data.sensitiveFindings.filter((item) => processLookup.get(item.pid) === selectedProcess)
    : data.sensitiveFindings

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div>
            <h2 className="text-sm font-semibold text-slate-100">What these insights can and cannot tell you</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              This analyzer reports evidence present in the selected logs. A URL, POST message, or upload keyword is not proof that data reached a server; logcat does not record every network connection or payload. Process names and component usage are inferred only when the log contains matching lines.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Cpu} label="Processes / PIDs" value={data.processes.length} color="text-purple-300" />
        <Metric icon={Network} label="Network-related log lines" value={data.networkEvidenceCount.toLocaleString()} color="text-sky-300" />
        <Metric icon={EyeOff} label="Possible sensitive-value matches" value={data.sensitiveFindingCount.toLocaleString()} color="text-rose-300" />
        <Metric icon={Activity} label="Lines not in threadtime format" value={data.unparsedLines.toLocaleString()} color="text-amber-300" />
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <div className="border-b border-line p-5">
          <h2 className="text-sm font-semibold text-slate-100">Processes observed in the logs</h2>
          <p className="mt-1 text-xs leading-5 text-muted">PIDs are grouped when a process name can be inferred from “Start proc” or crash context lines. Select a row to filter the evidence below.</p>
        </div>
        {data.processes.length ? (
          <div className="max-h-[430px] overflow-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="sticky top-0 bg-[#121a26] text-[10px] uppercase tracking-wider text-slate-500">
                <tr><th className="px-5 py-3">Process / package</th><th className="px-4 py-3">Observed PIDs</th><th className="px-4 py-3 text-right">Log lines</th><th className="px-4 py-3 text-right">Files</th><th className="px-5 py-3">Most common tags</th></tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {data.processes.map((process) => (
                  <tr key={process.name} onClick={() => setSelectedProcess(selectedProcess === process.name ? '' : process.name)} className={`cursor-pointer hover:bg-white/[0.03] ${selectedProcess === process.name ? 'bg-accent/[0.04]' : ''}`}>
                    <td className="px-5 py-3"><span className="font-medium text-slate-200">{process.name}</span></td>
                    <td className="px-4 py-3 font-mono text-slate-400">{process.pids.slice(0, 5).join(', ')}{process.pids.length > 5 ? ` +${process.pids.length - 5}` : ''}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">{process.lines.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-slate-400">{process.files.length}</td>
                    <td className="max-w-[260px] px-5 py-3"><div className="flex flex-wrap gap-1">{process.tags.slice(0, 4).map((tag) => <span key={tag.tag} className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{tag.tag}</span>)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="No process IDs were found in threadtime-formatted lines." />
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-line bg-panel">
          <div className="flex items-center justify-between border-b border-line p-5">
            <div><h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Network className="h-4 w-4 text-sky-300" /> Network / possible outbound evidence</h2><p className="mt-1 text-xs text-muted">URLs, HTTP methods, networking libraries, and upload-related log messages · examples are capped</p></div>
            {selectedProcess && <button type="button" onClick={() => setSelectedProcess('')} className="text-[10px] text-accent hover:underline">Clear process filter</button>}
          </div>
          <div className="max-h-[480px] overflow-auto">
            {evidence.length ? evidence.map((item, index) => (
              <article key={`${item.fileName}-${item.timestamp}-${item.pid}-${index}`} className="border-b border-line/70 p-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${item.direction === 'Possible outbound activity' ? 'border-amber-400/20 bg-amber-400/5 text-amber-300' : 'border-sky-400/20 bg-sky-400/5 text-sky-300'}`}>{item.direction}</span>
                  {item.method && <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">{item.method}</span>}
                  <span className="font-mono text-[10px] text-slate-500">{item.timestamp}</span>
                </div>
                <p className="mt-2 break-all text-xs text-slate-200">{item.endpoints.length ? item.endpoints.join(', ') : 'No URL was logged; matched a network-related keyword.'}</p>
                <p className="mt-1 break-words font-mono text-[10px] leading-4 text-slate-500">{item.sample}</p>
                <p className="mt-2 truncate text-[10px] text-slate-600">{processLookup.get(item.pid) || `PID ${item.pid}`} · {item.tag} · {item.fileName}</p>
              </article>
            )) : <Empty text="No network-related patterns found in the parsed log messages." />}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-panel">
          <div className="border-b border-line p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><ShieldAlert className="h-4 w-4 text-rose-300" /> Possible sensitive data in logs</h2>
            <p className="mt-1 text-xs leading-5 text-muted">Heuristic matches only. Values are redacted in this summary; inspect the original file locally if needed.</p>
          </div>
          <div className="max-h-[480px] overflow-auto">
            {sensitive.length ? sensitive.map((item, index) => (
              <article key={`${item.fileName}-${item.timestamp}-${index}`} className="border-b border-line/70 p-4 last:border-b-0">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium text-rose-200">{item.kind}</span><span className="font-mono text-[10px] text-slate-500">{item.timestamp}</span></div>
                <p className="mt-2 break-words font-mono text-[10px] leading-4 text-slate-400">{item.sample}</p>
                <p className="mt-2 truncate text-[10px] text-slate-600">{processLookup.get(item.pid) || `PID ${item.pid}`} · {item.tag} · {item.fileName}</p>
              </article>
            )) : <Empty text="No common sensitive-value patterns matched. This does not guarantee logs contain no private data." />}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <TagInventory tags={data.tags} />
        <section className="rounded-xl border border-line bg-panel p-5">
          <h2 className="text-sm font-semibold text-slate-100">Android log priority counts</h2>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['V', 'Verbose', 'Deep diagnostic detail'],
              ['D', 'Debug', 'Developer diagnostics'],
              ['I', 'Info', 'Normal operation'],
              ['W', 'Warning', 'Potential concern'],
              ['E', 'Error', 'Operation failed'],
              ['F', 'Fatal', 'Fatal condition'],
              ['A', 'Assert', 'Assertion failure'],
            ].map(([key, name, description]) => <div key={key} className="rounded-lg border border-line bg-canvas p-3"><div className="flex items-center justify-between"><span className="font-mono text-sm font-bold text-slate-200">{key}</span><span className="font-mono text-xs text-slate-400">{(data.priorities[key] || 0).toLocaleString()}</span></div><p className="mt-1 text-[10px] font-medium text-slate-300">{name}</p><p className="mt-1 text-[10px] text-slate-600">{description}</p></div>)}
          </div>
        </section>
      </section>
    </div>
  )
}

function TagInventory({ tags }) {
  const indicators = [
    { pattern: /okhttp|retrofit|volley|cronet|httpurlconnection/i, label: 'HTTP / networking client' },
    { pattern: /firebase|analytics|telemetry|crashlytics/i, label: 'Analytics / Firebase mention' },
    { pattern: /workmanager|jobscheduler|jobservice/i, label: 'Background work scheduler' },
    { pattern: /webview|chromium/i, label: 'Embedded web view' },
    { pattern: /sqlite|room/i, label: 'Local database' },
    { pattern: /location|fusedlocation/i, label: 'Location services' },
    { pattern: /bluetooth|\bble\b/i, label: 'Bluetooth' },
  ].flatMap((indicator) => {
    const matches = tags.filter((item) => indicator.pattern.test(item.tag))
    return matches.length ? [{ ...indicator, tags: matches.map((item) => item.tag) }] : []
  })

  return (
    <section className="rounded-xl border border-line bg-panel p-5">
      <h2 className="text-sm font-semibold text-slate-100">Tags / components seen</h2>
      <p className="mt-1 text-xs text-muted">Tags reveal which logger emitted messages; they are not a full inventory of app libraries.</p>
      {indicators.length > 0 && (
        <div className="mt-4 rounded-lg border border-sky-400/15 bg-sky-400/[0.04] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-200">Possible component mentions in tags</p>
          <div className="mt-2 space-y-2">
            {indicators.map((indicator) => <p key={indicator.label} className="text-[11px] text-slate-300"><span className="text-sky-200">{indicator.label}</span><span className="ml-2 font-mono text-slate-500">{indicator.tags.join(', ')}</span></p>)}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">These are tag-name clues only. They do not prove a library is installed or reveal everything it does.</p>
        </div>
      )}
      {tags.length ? (
        <div className={`${indicators.length ? 'mt-3' : 'mt-4'} max-h-60 space-y-2 overflow-auto`}>
          {tags.slice(0, 30).map((item) => <div key={item.tag} className="flex items-center justify-between gap-3"><span className="truncate font-mono text-xs text-sky-200/80">{item.tag}</span><span className="font-mono text-[10px] text-slate-500">{item.count.toLocaleString()}</span></div>)}
        </div>
      ) : <p className="mt-4 text-xs text-slate-500">No tags found.</p>}
    </section>
  )
}

function Metric({ icon: Icon, label, value, color }) {
  return <article className="rounded-xl border border-line bg-panel p-4"><div className="flex items-center justify-between"><p className="text-xs text-muted">{label}</p><Icon className={`h-4 w-4 ${color}`} /></div><p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p></article>
}

function Empty({ text }) {
  return <p className="px-5 py-10 text-center text-xs text-slate-500">{text}</p>
}

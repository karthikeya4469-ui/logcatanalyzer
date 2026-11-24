import { useState } from 'react'
import { Check, Clipboard, ExternalLink, X } from 'lucide-react'
import { CATEGORIES } from '../utils/defaultRules.js'

export default function StackTraceDrawer({ issue, onClose }) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  if (!issue) return null

  const copyTrace = async () => {
    try {
      await navigator.clipboard.writeText(issue.traces.join('\n\n--- repeated stack ---\n\n'))
      setCopied(true)
      setCopyError('')
      window.setTimeout(() => setCopied(false), 1800)
    } catch (reason) {
      setCopied(false)
      setCopyError(reason instanceof Error ? `Clipboard access failed: ${reason.message}` : 'Clipboard access failed.')
    }
  }
  const info = CATEGORIES[issue.category]

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Close issue details" onClick={onClose} className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-[2px]" />
      <aside role="dialog" aria-modal="true" aria-labelledby="drawer-title" className="relative flex h-full w-full max-w-2xl flex-col border-l border-line bg-[#0c121b] shadow-2xl">
        <div className="flex items-start justify-between border-b border-line px-6 py-5">
          <div className="min-w-0 pr-4">
            <span className="inline-flex rounded-full border px-2 py-1 text-[10px]" style={{ color: info.color, borderColor: `${info.color}35`, backgroundColor: `${info.color}10` }}>{info.label}</span>
            <h2 id="drawer-title" className="mt-3 break-words text-base font-semibold text-slate-100">{issue.title}</h2>
            <p className="mt-1 font-mono text-[11px] text-slate-500">{issue.tag} · signature {issue.signatureHash}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-200" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-3 gap-3 border-b border-line px-6 py-4">
          {[['Occurrences', issue.occurrences], ['Affected files', issue.files.length], ['Severity', issue.severity]].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line bg-panel px-3 py-2">
              <p className="text-[10px] text-muted">{label}</p><p className="mt-1 truncate text-sm font-medium text-slate-200">{value}</p>
            </div>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-6 py-4">
            <div><h3 className="text-xs font-semibold text-slate-200">Stack trace / log context</h3><p className="mt-1 text-[10px] text-slate-500">{issue.traces.length} distinct trace{issue.traces.length === 1 ? '' : 's'} in this signature</p></div>
            <button type="button" onClick={copyTrace} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/5">
              {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Clipboard className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          {copyError && <p role="alert" className="px-6 pb-3 text-xs text-rose-300">{copyError}</p>}
          <div className="min-h-36 flex-1 overflow-auto px-6 pb-5">
            <pre className="min-h-full whitespace-pre-wrap break-words rounded-lg border border-line bg-[#080c12] p-4 font-mono text-[11px] leading-5 text-slate-300">{issue.traces.join('\n\n--- distinct trace ---\n\n') || 'No stack trace captured.'}</pre>
          </div>
          <div className="max-h-52 shrink-0 overflow-auto border-t border-line px-6 py-4">
            <h3 className="mb-3 text-xs font-semibold text-slate-200">Affected files <span className="ml-1 font-normal text-slate-500">({issue.files.length})</span></h3>
            <ul className="space-y-1.5">
              {issue.files.map((file) => (
                <li key={file} className="flex items-center gap-2 truncate text-xs text-slate-400">
                  <ExternalLink className="h-3 w-3 shrink-0 text-slate-600" /> <span className="truncate" title={file}>{file}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  )
}

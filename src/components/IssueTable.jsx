import { useMemo, useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { CATEGORIES } from '../utils/defaultRules.js'

export default function IssueTable({ issues, onSelect }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('ALL')
  const [tag, setTag] = useState('')
  const [filename, setFilename] = useState('')

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return issues.filter((issue) => {
      if (category !== 'ALL' && issue.category !== category) return false
      if (tag && !issue.tag.toLowerCase().includes(tag.toLowerCase())) return false
      if (filename && !issue.files.some((name) => name.toLowerCase().includes(filename.toLowerCase()))) return false
      return !normalizedQuery || [issue.title, issue.tag, issue.category, issue.signatureHash]
        .join(' ').toLowerCase().includes(normalizedQuery)
    })
  }, [issues, query, category, tag, filename])

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="flex flex-col gap-4 border-b border-line p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Detected issues</h2>
          <p className="mt-1 text-xs text-muted">{filtered.length.toLocaleString()} grouped signatures · sorted by occurrence count</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-48 flex-1 lg:flex-none">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search issues..." className="w-full rounded-lg border border-line bg-canvas py-2 pl-8 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-slate-500 lg:w-44" />
          </label>
          <label className="relative">
            <SlidersHorizontal className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-line bg-canvas py-2 pl-8 pr-7 text-xs text-slate-300 outline-none focus:border-slate-500">
              <option value="ALL">All categories</option>
              {Object.entries(CATEGORIES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </select>
          </label>
          <input value={tag} onChange={(event) => setTag(event.target.value)} placeholder="Filter tag" className="w-28 rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-slate-500" />
          <input value={filename} onChange={(event) => setFilename(event.target.value)} placeholder="Filter filename" className="w-32 rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-slate-500" />
        </div>
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full min-w-[790px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[#121a26] text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Severity / category</th>
              <th className="px-4 py-3 font-medium">Issue title / tag</th>
              <th className="px-4 py-3 text-right font-medium">Occurrences</th>
              <th className="px-4 py-3 text-right font-medium">Files</th>
              <th className="px-4 py-3 font-medium">First / last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {filtered.map((issue) => {
              const info = CATEGORIES[issue.category]
              return (
                <tr key={issue.signatureHash} onClick={() => onSelect(issue)} tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && onSelect(issue)} className="cursor-pointer transition hover:bg-white/[0.025] focus:bg-white/[0.04]">
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium" style={{ color: info.color, borderColor: `${info.color}35`, backgroundColor: `${info.color}10` }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: info.color }} />{info.severity} · {info.label}
                    </span>
                  </td>
                  <td className="max-w-[360px] px-4 py-3.5">
                    <p className="truncate text-xs font-medium text-slate-200">{issue.title}</p>
                    <p className="mt-1 truncate font-mono text-[10px] text-slate-500">{issue.tag} <span className="text-slate-700">· {issue.signatureHash}</span></p>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-slate-200">{issue.occurrences.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-right text-xs text-slate-400">{issue.files.length.toLocaleString()}</td>
                  <td className="px-4 py-3.5 font-mono text-[10px] leading-5 text-slate-400">
                    <div>{issue.firstSeen}</div><div className="text-slate-600">{issue.lastSeen}</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="px-4 py-16 text-center">
            <p className="text-sm text-slate-400">{issues.length ? 'No issues match these filters' : 'No issues detected yet'}</p>
            <p className="mt-1 text-xs text-slate-600">{issues.length ? 'Try adjusting your search or filters' : 'Detected signatures will appear here after scanning'}</p>
          </div>
        )}
      </div>
    </section>
  )
}

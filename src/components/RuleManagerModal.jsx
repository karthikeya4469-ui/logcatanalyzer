import { useRef, useState } from 'react'
import { Download, Plus, Trash2, Upload, X } from 'lucide-react'

export default function RuleManagerModal({ rules, onSave, onClose }) {
  const [draft, setDraft] = useState(() => ({
    tags: [...rules.tags],
    regexRules: rules.regexRules.map((rule) => ({ ...rule })),
  }))
  const [tagInput, setTagInput] = useState('')
  const [newRule, setNewRule] = useState({ name: '', pattern: '', flags: 'i' })
  const [error, setError] = useState('')
  const importInput = useRef(null)

  const save = () => {
    try {
      draft.regexRules.forEach((rule) => new RegExp(rule.pattern, rule.flags || 'i'))
      localStorage.setItem('logscope-custom-rules-v1', JSON.stringify(draft))
      onSave(draft)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Rules could not be saved.')
    }
  }

  const addTag = () => {
    const value = tagInput.trim()
    if (!value) return
    if (draft.tags.some((tag) => tag.toLowerCase() === value.toLowerCase())) {
      setError('That tag is already in your rules.')
      return
    }
    setDraft((current) => ({ ...current, tags: [...current.tags, value] }))
    setTagInput('')
    setError('')
  }

  const addRegex = () => {
    if (!newRule.pattern.trim()) {
      setError('Enter a regular expression pattern.')
      return
    }
    try {
      new RegExp(newRule.pattern, newRule.flags || 'i')
      setDraft((current) => ({
        ...current,
        regexRules: [...current.regexRules, { ...newRule, id: crypto.randomUUID() }],
      }))
      setNewRule({ name: '', pattern: '', flags: 'i' })
      setError('')
    } catch (reason) {
      setError(`Invalid regular expression: ${reason.message}`)
    }
  }

  const updateRule = (id, field, value) => {
    setDraft((current) => ({
      ...current,
      regexRules: current.regexRules.map((rule) => rule.id === id ? { ...rule, [field]: value } : rule),
    }))
  }

  const exportRules = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'logscope-rules.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const importRules = async (file) => {
    if (!file) return
    try {
      const imported = JSON.parse(await file.text())
      if (!imported || !Array.isArray(imported.tags) || !Array.isArray(imported.regexRules)) {
        throw new Error('JSON must contain tags and regexRules arrays.')
      }
      imported.regexRules.forEach((rule) => {
        if (!rule || typeof rule.pattern !== 'string') throw new Error('Each regex rule needs a pattern.')
        new RegExp(rule.pattern, rule.flags || 'i')
      })
      setDraft({
        tags: [...new Set(imported.tags.filter((tag) => typeof tag === 'string'))],
        regexRules: imported.regexRules.map((rule) => ({
          ...rule,
          id: rule.id || crypto.randomUUID(),
          name: typeof rule.name === 'string' ? rule.name : '',
          flags: typeof rule.flags === 'string' ? rule.flags : 'i',
        })),
      })
      setError('')
    } catch (reason) {
      setError(`Could not import rules: ${reason instanceof Error ? reason.message : String(reason)}`)
    }
    if (importInput.current) importInput.current.value = ''
  }

  const inputClass = 'w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-slate-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="rules-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-[#0e151f] shadow-2xl">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div><h2 id="rules-title" className="text-sm font-semibold text-slate-100">Custom detection rules</h2><p className="mt-1 text-xs text-muted">Rules are saved only in this browser</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-200" aria-label="Close"><X className="h-4 w-4" /></button>
        </header>
        <div className="space-y-6 overflow-auto p-5">
          <div>
            <h3 className="mb-2 text-xs font-semibold text-slate-200">Custom app tags</h3>
            <p className="mb-3 text-[11px] text-slate-500">Match exact logcat tags; each matching line is recorded.</p>
            <div className="flex gap-2">
              <input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addTag()} placeholder="e.g. MyApplication" className={inputClass} />
              <button type="button" onClick={addTag} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-3 text-xs text-slate-300 hover:bg-white/5"><Plus className="h-3.5 w-3.5" /> Add tag</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {draft.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1.5 font-mono text-[11px] text-slate-300">{tag}<button type="button" aria-label={`Remove ${tag}`} onClick={() => setDraft((current) => ({ ...current, tags: current.tags.filter((entry) => entry !== tag) }))} className="text-slate-600 hover:text-rose-300"><X className="h-3 w-3" /></button></span>)}
              {!draft.tags.length && <span className="text-[11px] text-slate-600">No custom tags yet.</span>}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold text-slate-200">Regex signatures</h3>
            <p className="mb-3 text-[11px] text-slate-500">Patterns run against each parsed log message. JavaScript regex syntax is supported.</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_2fr_70px_auto]">
              <input value={newRule.name} onChange={(event) => setNewRule({ ...newRule, name: event.target.value })} placeholder="Rule name" className={inputClass} />
              <input value={newRule.pattern} onChange={(event) => setNewRule({ ...newRule, pattern: event.target.value })} placeholder="Pattern, e.g. network timeout" className={`${inputClass} font-mono`} />
              <input value={newRule.flags} onChange={(event) => setNewRule({ ...newRule, flags: event.target.value })} aria-label="Regex flags" className={`${inputClass} font-mono`} />
              <button type="button" onClick={addRegex} className="inline-flex items-center justify-center gap-1 rounded-lg border border-line px-3 py-2 text-xs text-slate-300 hover:bg-white/5"><Plus className="h-3.5 w-3.5" /> Add</button>
            </div>
            <div className="mt-3 space-y-2">
              {draft.regexRules.map((rule) => (
                <div key={rule.id} className="grid gap-2 rounded-lg border border-line bg-panel p-2 sm:grid-cols-[1fr_2fr_60px_30px]">
                  <input aria-label="Rule name" value={rule.name || ''} onChange={(event) => updateRule(rule.id, 'name', event.target.value)} placeholder="Rule name" className={inputClass} />
                  <input aria-label="Regex pattern" value={rule.pattern} onChange={(event) => updateRule(rule.id, 'pattern', event.target.value)} className={`${inputClass} font-mono`} />
                  <input aria-label="Regex flags" value={rule.flags || 'i'} onChange={(event) => updateRule(rule.id, 'flags', event.target.value)} className={`${inputClass} font-mono`} />
                  <button type="button" aria-label="Delete regex rule" onClick={() => setDraft((current) => ({ ...current, regexRules: current.regexRules.filter((entry) => entry.id !== rule.id) }))} className="flex items-center justify-center text-slate-500 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              {!draft.regexRules.length && <span className="text-[11px] text-slate-600">No regex signatures yet.</span>}
            </div>
          </div>
          {error && <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/5 px-3 py-2 text-xs text-rose-300">{error}</p>}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-4">
          <div className="flex gap-2">
            <input ref={importInput} type="file" accept=".json,application/json" className="hidden" onChange={(event) => importRules(event.target.files?.[0])} />
            <button type="button" onClick={() => importInput.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs text-slate-300 hover:bg-white/5"><Upload className="h-3.5 w-3.5" /> Import JSON</button>
            <button type="button" onClick={exportRules} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs text-slate-300 hover:bg-white/5"><Download className="h-3.5 w-3.5" /> Export</button>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
            <button type="button" onClick={save} className="rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300">Save rules</button>
          </div>
        </footer>
      </section>
    </div>
  )
}

import { useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, FileText, FolderOpen, HardDriveUpload, LoaderCircle } from 'lucide-react'

function isSupported(file) {
  const name = file.webkitRelativePath || file.name
  const baseName = name.split(/[\\/]/).pop() || ''
  const extension = baseName.includes('.') ? baseName.split('.').pop().toLowerCase() : ''
  return extension === '' || extension === 'log' || extension === 'txt'
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FolderUploader({ onFiles, progress, busy, fileCount, totalBytes, error }) {
  const fileInput = useRef(null)
  const folderInput = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [selectionNote, setSelectionNote] = useState('')

  const chooseFiles = (list) => {
    const selected = Array.from(list || [])
    const accepted = selected.filter(isSupported)
    setSelectionNote(selected.length > accepted.length ? `${selected.length - accepted.length} unsupported file${selected.length - accepted.length === 1 ? '' : 's'} skipped. Choose .txt, .log, or extensionless files.` : '')
    if (accepted.length) onFiles(accepted)
    if (fileInput.current) fileInput.current.value = ''
    if (folderInput.current) folderInput.current.value = ''
  }

  const done = progress?.completedFiles || 0
  const percent = progress?.totalFiles ? Math.round((done / progress.totalFiles) * 100) : 0
  const currentPercent = progress && !progress.done && progress.totalBytes
    ? Math.round((progress.loadedBytes / progress.totalBytes) * 100)
    : 0

  return (
    <section
      className={`rounded-2xl border bg-panel p-5 transition ${dragging ? 'border-accent shadow-glow' : 'border-line'}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        chooseFiles(event.dataTransfer.files)
      }}
    >
      <input ref={fileInput} className="hidden" type="file" multiple onChange={(event) => chooseFiles(event.target.files)} />
      <input ref={folderInput} className="hidden" type="file" multiple webkitdirectory="" directory="" onChange={(event) => chooseFiles(event.target.files)} />
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-xl border border-accent/20 bg-accent/10 p-3 text-accent">
            {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <HardDriveUpload className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="font-semibold text-slate-100">{busy ? 'Scanning logs locally' : 'Analyze log files'}</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
              Drop files or choose a folder. Log contents stay in this browser; nothing is uploaded.
            </p>
            {fileCount > 0 && !busy && (
              <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <FileText className="h-3.5 w-3.5" /> {fileCount.toLocaleString()} files · {formatBytes(totalBytes)} in this batch
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-3.5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText className="h-4 w-4" /> Choose files
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => folderInput.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FolderOpen className="h-4 w-4" /> Choose folder
          </button>
        </div>
      </div>

      {busy && (
        <div className="mt-5 border-t border-line pt-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-slate-300">
              {done.toLocaleString()} / {progress?.totalFiles?.toLocaleString() || 0} files
              {progress?.fileName && <span className="ml-2 text-muted">· {progress.fileName.split(/[\\/]/).pop()}</span>}
            </span>
            <span className="font-mono text-accent">{percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${percent}%` }} />
          </div>
          {progress?.totalBytes > 0 && !progress.done && (
            <p className="mt-2 text-right font-mono text-[11px] text-muted">
              Current file: {formatBytes(progress.loadedBytes)} / {formatBytes(progress.totalBytes)} ({currentPercent}%)
            </p>
          )}
        </div>
      )}
      {!busy && progress?.done && (
        <div className="mt-4 flex items-center gap-2 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Scan complete. Select more files to start another batch.
        </div>
      )}
      {selectionNote && <p role="status" className="mt-3 text-xs text-amber-300">{selectionNote}</p>}
      {error && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-rose-400/20 bg-rose-400/5 px-3 py-2.5 text-sm text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      <p className="mt-4 text-[11px] text-slate-500">Supported: .txt, .log, and extensionless files · Multi-worker processing · Local-only analysis</p>
    </section>
  )
}

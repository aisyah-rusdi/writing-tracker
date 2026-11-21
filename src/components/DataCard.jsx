import { useRef, useState } from 'react'
import { describeError } from '../lib/api'
import { buildPreview, exportCsv, importEntries } from '../lib/importExport'
import Collapsible from './Collapsible'

const fmt = (n) => n.toLocaleString('en-US')
const SHOW_PROBLEMS = 5
const MAX_FILE_BYTES = 2 * 1024 * 1024

// onImported: called after an import ends (finished or stopped part-way), so the
// shared state reloads from the sheet and every page shows the imported words.
export default function DataCard({ projects, loading, configured, onImported }) {
  const fileRef = useRef(null)
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState(null) // result of buildPreview, waiting for a go-ahead
  const [progress, setProgress] = useState(null) // { done, total } while importing
  const [result, setResult] = useState(null) // { added, existing, stopped } after an import
  const [failure, setFailure] = useState(null) // { error, retry: 'import' | 'export' }
  const [notice, setNotice] = useState('') // plain message (file too big, export done)
  const [exporting, setExporting] = useState(false)

  const importing = progress !== null
  const busy = importing || exporting
  const waitingForProjects = loading && projects.length === 0
  const disabled = !configured || busy || waitingForProjects

  function reset() {
    setPreview(null)
    setResult(null)
    setFailure(null)
    setNotice('')
    setFileName('')
  }

  async function onFile(event) {
    const file = event.target.files && event.target.files[0]
    event.target.value = '' // so choosing the same file again still fires
    if (!file) return
    reset()
    if (file.size > MAX_FILE_BYTES) {
      setNotice('That file is too large for a writing log. Choose a CSV file.')
      return
    }
    try {
      const text = await file.text()
      setFileName(file.name)
      setPreview(buildPreview(text, projects))
    } catch {
      setNotice('Could not read that file.')
    }
  }

  async function runImport() {
    if (!preview || preview.problems.length || importing) return
    setFailure(null)
    setResult(null)
    setProgress({ done: 0, total: preview.entries.length })
    const out = await importEntries(preview.entries, (done, total) => setProgress({ done, total }))
    setProgress(null)
    if (out.error) {
      setFailure({ error: out.error, retry: 'import' })
      setResult({ added: out.added, existing: out.existing, stopped: true })
    } else {
      setResult({ added: out.added, existing: out.existing, stopped: false })
      setPreview(null)
      setFileName('')
    }
    // Reload from the sheet, also after a partial failure: some entries did land.
    if (onImported && out.added > 0) {
      try {
        await onImported()
      } catch {
        // The shared state shows its own error banner if the reload fails.
      }
    }
  }

  async function runExport() {
    setFailure(null)
    setNotice('')
    setExporting(true)
    try {
      const count = await exportCsv()
      setNotice(count ? `Exported ${fmt(count)} entries.` : 'Nothing to export yet.')
    } catch (error) {
      setFailure({ error, retry: 'export' })
    } finally {
      setExporting(false)
    }
  }

  const problems = preview ? preview.problems : []
  const canImport = preview && problems.length === 0 && !busy

  return (
    <Collapsible id="data" title="Data" className="settings-data">
      <h2>Data</h2>

      {!configured && (
        <p className="mut settings__note">Connect your sheet first, then import and export work.</p>
      )}

      <div className="chips">
        <button
          type="button"
          className="btn sec"
          disabled={disabled}
          onClick={() => fileRef.current && fileRef.current.click()}
        >
          Import existing log
        </button>
        <button type="button" className="btn sec" disabled={disabled} onClick={runExport}>
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={onFile}
        aria-label="Choose a CSV file to import"
      />
      <p className="mut settings__note">
        CSV with the columns Date, Project, Words, Note. Excel opens the export directly.
      </p>

      {notice && (
        <p className="mut" role="status">
          {notice}
        </p>
      )}

      {preview && (
        <div className="data-preview">
          <p className="mut data-file">{fileName}</p>

          {problems.length > 0 ? (
            <>
              <p className="form-error" role="alert">
                This file can’t be imported yet. Fix these and choose it again:
              </p>
              <ul className="data-list">
                {problems.slice(0, SHOW_PROBLEMS).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              {problems.length > SHOW_PROBLEMS && (
                <p className="mut">and {problems.length - SHOW_PROBLEMS} more.</p>
              )}
            </>
          ) : (
            <>
              <div className="data-summary">
                <span className="num">{fmt(preview.entries.length)} entries</span> ·{' '}
                {fmt(preview.days)} days · <span className="num">{fmt(preview.totalWords)}</span> words
              </div>
              {preview.byProject.map((p) => (
                <div className="data-project" key={p.id}>
                  <span className="dot" style={{ background: p.colour }} />
                  <span>{p.name}</span>
                  <span className="num">{fmt(p.words)}</span>
                </div>
              ))}
              {preview.skipped > 0 && (
                <p className="mut">
                  {fmt(preview.skipped)} rows with 0 or blank words are skipped. They stay as
                  unlogged days.
                </p>
              )}
            </>
          )}

          {importing ? (
            <div role="status">
              <div className="data-progress">
                <i style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
              <p className="mut">
                Importing {fmt(progress.done)} of {fmt(progress.total)}… keep this page open.
              </p>
            </div>
          ) : (
            <div className="data-actions">
              {problems.length === 0 && (
                <button type="button" className="btn" disabled={!canImport} onClick={runImport}>
                  Import {fmt(preview.entries.length)} entries
                </button>
              )}
              <button type="button" className="btn sec" disabled={busy} onClick={reset}>
                {problems.length === 0 ? 'Cancel' : 'Close'}
              </button>
            </div>
          )}
        </div>
      )}

      {failure && (
        <div className="banner banner--error" role="alert">
          <b>{describeError(failure.error).title}</b>
          {describeError(failure.error).message}
          {result && result.stopped && (
            <div>
              {fmt(result.added + result.existing)} entries were already saved. Try again to
              finish: those are skipped.
            </div>
          )}
          <div>
            <button
              type="button"
              className="btn sec"
              disabled={busy}
              onClick={failure.retry === 'import' ? runImport : runExport}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {result && !result.stopped && (
        <p className="data-done" role="status">
          {result.added > 0
            ? `Imported ${fmt(result.added)} new entries${
                result.existing > 0 ? ` (${fmt(result.existing)} were already there)` : ''
              }.`
            : 'Everything in that file was already imported.'}
        </p>
      )}
    </Collapsible>
  )
}
import { useMemo, useState } from 'react'
import { useEntries } from '../hooks/useEntries'
import { describeError } from '../lib/api'
import { getPref } from '../lib/prefs'
import ProjectPicker from './ProjectPicker'

const fmt = (n) => n.toLocaleString('en-US')
const digits = (s) => s.replace(/\D/g, '').slice(0, 7)
const MAX_NOTE = 200

// Everything inside the day sheet for one date ('yyyy-MM-dd').
// Entries the sheet already has can be edited or deleted. Entries still syncing
// or failed show their badge instead, because they can't be changed until saved.
export default function DaySheet({ date }) {
  const { entries, projects, save, update, remove, retry } = useEntries()

  const dayEntries = entries.filter((e) => e.date === date)
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
  const active = useMemo(
    () => projects.filter((p) => !p.archived).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    [projects]
  )

  const [editingId, setEditingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  const [words, setWords] = useState('')
  const [projectId, setProjectId] = useState(() => getPref('lastProject', null))
  const selected = active.find((p) => p.id === projectId) || active[0]
  const amount = parseInt(words, 10)
  const canAdd = Boolean(selected) && amount >= 1

  // Runs a change, shows its error (if any) and keeps the buttons busy meanwhile.
  async function run(id, action) {
    setBusyId(id)
    setError('')
    try {
      await action()
    } catch (err) {
      setError(describeError(err).message)
    } finally {
      setBusyId(null)
    }
  }

  function add(e) {
    e.preventDefault()
    if (!canAdd) return
    save({ projectId: selected.id, words: amount, note: '', date })
    setWords('')
  }

  function renderEntry(entry) {
    const project = byId.get(entry.projectId)
    const status = entry.status || 'saved'
    const busy = busyId === entry.id

    if (editingId === entry.id) {
      const choices = [...active, ...(project && project.archived ? [project] : [])]
      return (
        <EditForm
          key={entry.id}
          entry={entry}
          choices={choices}
          busy={busy}
          onCancel={() => setEditingId(null)}
          onSave={(changes) =>
            run(entry.id, async () => {
              await update(entry.id, changes)
              setEditingId(null)
            })
          }
        />
      )
    }

    return (
      <div className="entry sheet-entry" key={entry.id}>
        <span className="dot" style={{ background: project ? project.colour : '#BDB5A3' }} />
        <div className="sheet-entry__main">
          <div>
            {project ? project.name : 'Unknown project'}
            {project && project.archived ? ' (archived)' : ''}
          </div>
          {entry.note && <div className="mut">{entry.note}</div>}
        </div>
        <span className="num entry__words">{fmt(entry.words)}</span>

        {status === 'failed' && (
          <button type="button" className="badge badge--failed" onClick={() => retry(entry.id)}>
            Not synced – tap to retry
          </button>
        )}
        {status === 'syncing' && <span className="badge badge--syncing">Syncing</span>}

        {status === 'saved' && deletingId !== entry.id && (
          <span className="sheet-entry__actions">
            <button
              type="button"
              className="btn sec btn--sm"
              disabled={busy}
              onClick={() => {
                setError('')
                setDeletingId(null)
                setEditingId(entry.id)
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn sec btn--sm sheet-entry__delete"
              disabled={busy}
              onClick={() => {
                setError('')
                setDeletingId(entry.id)
              }}
            >
              Delete
            </button>
          </span>
        )}

        {status === 'saved' && deletingId === entry.id && (
          <span className="sheet-entry__confirm">
            <span className="mut">Delete {fmt(entry.words)} words?</span>
            <button
              type="button"
              className="btn sec btn--sm sheet-entry__delete"
              disabled={busy}
              onClick={() => run(entry.id, () => remove(entry.id))}
            >
              {busy ? 'Deleting…' : 'Delete'}
            </button>
            <button
              type="button"
              className="btn sec btn--sm"
              disabled={busy}
              onClick={() => setDeletingId(null)}
            >
              Keep
            </button>
          </span>
        )}
      </div>
    )
  }

  return (
    <>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {dayEntries.length === 0 ? (
        <p className="mut">Nothing logged on this day.</p>
      ) : (
        dayEntries.map(renderEntry)
      )}

      <form className="sheet-add" onSubmit={add}>
        <h3>{dayEntries.length ? 'Add another entry' : 'Add an entry'}</h3>
        {active.length === 0 ? (
          <p className="mut">Add a project in Settings first.</p>
        ) : (
          <>
            <label className="field">
              <span>Words</span>
              <input
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={words}
                onChange={(e) => setWords(digits(e.target.value))}
              />
            </label>
            <ProjectPicker
              projects={active}
              value={selected.id}
              onChange={setProjectId}
            />
            <button type="submit" className="btn sheet-add__btn" disabled={!canAdd}>
              Add entry
            </button>
          </>
        )}
      </form>
    </>
  )
}

function EditForm({ entry, choices, busy, onSave, onCancel }) {
  const [words, setWords] = useState(String(entry.words))
  const [projectId, setProjectId] = useState(entry.projectId)
  const [note, setNote] = useState(entry.note || '')
  const [problem, setProblem] = useState('')

  function submit(e) {
    e.preventDefault()
    const n = parseInt(words, 10)
    if (!(n >= 1)) return setProblem('Words must be a whole number, 1 or more.')
    setProblem('')
    onSave({ words: n, projectId, note: note.trim() })
  }

  return (
    <form className="sheet-edit" onSubmit={submit}>
      <label className="field">
        <span>Words</span>
        <input
          inputMode="numeric"
          autoComplete="off"
          value={words}
          onChange={(e) => setWords(digits(e.target.value))}
        />
      </label>
      <div className="mut sheet-edit__label">Project</div>
      <ProjectPicker projects={choices} value={projectId} onChange={setProjectId} />
      <label className="field sheet-edit__note">
        <span>Note</span>
        <input value={note} maxLength={MAX_NOTE} onChange={(e) => setNote(e.target.value)} />
      </label>
      {problem && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className="btn sec" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
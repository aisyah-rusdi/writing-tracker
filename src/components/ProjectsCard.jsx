import { useState } from 'react'
import { describeError } from '../lib/api'
import ProjectForm from './ProjectForm'

const fmt = (n) => n.toLocaleString('en-US')
const PAGE_SIZE = 5 // project rows per page (active first, then archived)

function goalsText(p) {
  const parts = []
  if (p.dailyGoal) parts.push(`${fmt(p.dailyGoal)}/day`)
  if (p.weeklyGoal) parts.push(`${fmt(p.weeklyGoal)}/week`)
  return parts.length ? parts.join(' · ') : 'No goal yet'
}

export default function ProjectsCard({
  projects,
  loading,
  error,
  configured,
  onAdd,
  onUpdate,
  onArchive,
  onRetry,
}) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [page, setPage] = useState(0)

  const list = configured ? projects : []
  const sorted = [...list].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  const active = sorted.filter((p) => !p.archived)
  const archived = sorted.filter((p) => p.archived)
  const namesExcept = (id) => list.filter((p) => p.id !== id).map((p) => p.name)
  const onlyOne = active.length <= 1

  // Active projects first, then archived ones, 5 rows to a page. The page is kept
  // in range, so archiving the last row of a page moves back instead of showing
  // an empty page.
  const rows = [...active, ...archived]
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const first = current * PAGE_SIZE
  const pageRows = rows.slice(first, first + PAGE_SIZE)

  async function setArchived(p, value) {
    setBusyId(p.id)
    setActionError('')
    try {
      await onArchive(p.id, value)
    } catch (err) {
      setActionError(describeError(err).message)
    } finally {
      setBusyId(null)
    }
  }

  function renderRow(p, i) {
    if (p.archived) {
      // The "Archived" label shows above the first archived row on each page.
      const showLabel = i === 0 || !pageRows[i - 1].archived
      return (
        <div key={p.id}>
          {showLabel && <p className="mut settings__archived">Archived</p>}
          <div className="project-row project-row--archived">
            <span className="dot" style={{ background: p.colour }} />
            <span>{p.name}</span>
            <div className="project-row__actions">
              <button
                type="button"
                className="btn sec btn--sm"
                disabled={busyId === p.id}
                onClick={() => setArchived(p, false)}
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )
    }

    if (editingId === p.id) {
      return (
        <ProjectForm
          key={p.id}
          initial={p}
          otherNames={namesExcept(p.id)}
          onSave={async (values) => {
            await onUpdate(p.id, values)
            setEditingId(null)
          }}
          onCancel={() => setEditingId(null)}
        />
      )
    }

    return (
      <div className="project-row" key={p.id}>
        <span className="dot" style={{ background: p.colour }} />
        <div className="project-row__main">
          <div>{p.name}</div>
          <div className="mut">{goalsText(p)}</div>
        </div>
        <div className="project-row__actions">
          <button
            type="button"
            className="btn sec btn--sm"
            onClick={() => {
              setAdding(false)
              setEditingId(p.id)
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn sec btn--sm"
            disabled={onlyOne || busyId === p.id}
            title={onlyOne ? 'Keep at least one active project' : undefined}
            onClick={() => setArchived(p, true)}
          >
            Archive
          </button>
        </div>
      </div>
    )
  }

  return (
    <section className="card settings-proj">
      <div className="row">
        <h2>Projects</h2>
        <button
          type="button"
          className="btn sec btn--sm"
          disabled={!configured || adding}
          onClick={() => {
            setEditingId(null)
            setAdding(true)
          }}
        >
          Add project
        </button>
      </div>

      {!configured && (
        <p className="mut settings__note">Connect your sheet first, then your projects appear here.</p>
      )}
      {configured && loading && list.length === 0 && (
        <p className="mut settings__note">Loading projects…</p>
      )}
      {configured && error && (
        <div className="banner banner--error" role="alert">
          <b>{describeError(error).title}</b>
          {describeError(error).message}
          <div>
            <button type="button" className="btn sec" onClick={onRetry}>
              Try again
            </button>
          </div>
        </div>
      )}
      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      {pageRows.map(renderRow)}

      {pageCount > 1 && (
        <div className="settings__pager">
          <button
            type="button"
            className="btn sec btn--sm"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            ‹ Previous
          </button>
          <span className="mut" aria-live="polite">
            Projects {first + 1}–{first + pageRows.length} of {rows.length}
          </span>
          <button
            type="button"
            className="btn sec btn--sm"
            disabled={current === pageCount - 1}
            onClick={() => setPage(current + 1)}
          >
            Next ›
          </button>
        </div>
      )}

      {adding && (
        <ProjectForm
          otherNames={namesExcept(null)}
          onSave={async (values) => {
            await onAdd(values)
            setAdding(false)
            // A new project joins the end of the list: jump to the last page.
            // (The page number is clamped above, so a big number means "last".)
            setPage(Number.MAX_SAFE_INTEGER)
          }}
          onCancel={() => setAdding(false)}
        />
      )}
    </section>
  )
}
import { useState } from 'react'
import { describeError } from '../lib/api'
import ProjectForm from './ProjectForm'

const fmt = (n) => n.toLocaleString('en-US')

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

  const list = configured ? projects : []
  const sorted = [...list].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  const active = sorted.filter((p) => !p.archived)
  const archived = sorted.filter((p) => p.archived)
  const namesExcept = (id) => list.filter((p) => p.id !== id).map((p) => p.name)
  const onlyOne = active.length <= 1

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

      {active.map((p) =>
        editingId === p.id ? (
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
        ) : (
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
      )}

      {adding && (
        <ProjectForm
          otherNames={namesExcept(null)}
          onSave={async (values) => {
            await onAdd(values)
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {archived.length > 0 && (
        <>
          <p className="mut settings__archived">Archived</p>
          {archived.map((p) => (
            <div className="project-row project-row--archived" key={p.id}>
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
          ))}
        </>
      )}
    </section>
  )
}
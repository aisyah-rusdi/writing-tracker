import { useState } from 'react'
import { describeError } from '../lib/api'

const SWATCHES = [
  { value: '#111111', label: 'Black' },
  { value: '#F28C28', label: 'Orange' },
  { value: '#3F6B4E', label: 'Green' },
  { value: '#E9A7B9', label: 'Pink' },
]
const HEX = /^#[0-9a-fA-F]{6}$/

// Same limit as the input box below and as validateName_ in apps-script/Code.gs.
const MAX_NAME = 60

// '' means no goal. Anything else must be a whole number of words, 1 or more.
function parseGoal(text) {
  const t = text.trim()
  if (t === '') return { value: null }
  if (!/^\d+$/.test(t) || Number(t) < 1) return { error: true }
  return { value: Number(t) }
}

const digits = (s) => s.replace(/\D/g, '').slice(0, 7)

// Used both to add a project (no `initial`) and to edit one.
// otherNames: the names of the other projects, to stop duplicates.
export default function ProjectForm({ initial, otherNames = [], onSave, onCancel }) {
  const [name, setName] = useState(initial ? initial.name : '')
  const [colour, setColour] = useState(
    initial && HEX.test(initial.colour) ? initial.colour.toUpperCase() : '#3F6B4E'
  )
  const [daily, setDaily] = useState(initial && initial.dailyGoal ? String(initial.dailyGoal) : '')
  const [weekly, setWeekly] = useState(initial && initial.weeklyGoal ? String(initial.weeklyGoal) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return setError('Give the project a name.')
    if (n.length > MAX_NAME) return setError(`Keep the name to ${MAX_NAME} characters or fewer.`)
    if (otherNames.some((x) => x.trim().toLowerCase() === n.toLowerCase())) {
      return setError('There is already a project with that name.')
    }
    const d = parseGoal(daily)
    const w = parseGoal(weekly)
    if (d.error || w.error) {
      return setError('Goals must be whole numbers of words, or left blank for no goal.')
    }
    setError('')
    setBusy(true)
    try {
      await onSave({ name: n, colour, dailyGoal: d.value, weeklyGoal: w.value })
    } catch (err) {
      setError(describeError(err).message)
      setBusy(false)
    }
  }

  return (
    <form className="project-form" onSubmit={submit}>
      <label className="field">
        <span>Name</span>
        <input value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} />
      </label>

      <div className="mut">Colour</div>
      <div className="swatches">
        {SWATCHES.map((s) => (
          <button
            key={s.value}
            type="button"
            className={'swatch' + (colour === s.value ? ' on' : '')}
            style={{ background: s.value }}
            aria-label={s.label}
            aria-pressed={colour === s.value}
            onClick={() => setColour(s.value)}
          />
        ))}
        <input
          type="color"
          className="swatch-custom"
          aria-label="Custom colour"
          value={colour.toLowerCase()}
          onChange={(e) => setColour(e.target.value.toUpperCase())}
        />
        <span className="mut">{colour}</span>
      </div>

      <div className="goals-grid">
        <label className="field">
          <span>Daily goal</span>
          <input
            inputMode="numeric"
            value={daily}
            placeholder="No goal yet"
            onChange={(e) => setDaily(digits(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Weekly goal</span>
          <input
            inputMode="numeric"
            value={weekly}
            placeholder="No goal yet"
            onChange={(e) => setWeekly(digits(e.target.value))}
          />
        </label>
      </div>
      <p className="hint">Leave a goal blank for no goal. Projects without goals never celebrate.</p>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn" disabled={busy}>
          Save project
        </button>
        <button type="button" className="btn sec" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  )
}
// Row of colour chips for a few projects, a dropdown when there are many.
const MAX_CHIPS = 4

export default function ProjectPicker({ projects, value, onChange, label = 'Project' }) {
  if (projects.length > MAX_CHIPS) {
    const current = projects.find((p) => p.id === value)
    return (
      <div className="picker-select">
        <span className="dot" style={{ background: current ? current.colour : 'transparent' }} />
        <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {projects.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={p.id === value}
          className={'chip' + (p.id === value ? ' on' : '')}
          onClick={() => onChange(p.id)}
        >
          <span className="dot" style={{ background: p.colour }} />
          {p.name}
        </button>
      ))}
    </div>
  )
}
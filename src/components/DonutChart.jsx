const fmt = (n) => n.toLocaleString('en-US')

const SIZE = 120 // drawing units; CSS sets the real size
const MID = SIZE / 2
const RADIUS = 44
const THICKNESS = 16
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP = 1.5 // small space between segments, in the same units as the circumference

// parts: [{ id, name, colour, words }]  (colours come from the Projects sheet)
// Draws nothing when there are no words.
export default function DonutChart({ parts, centreLabel = 'words' }) {
  const total = parts.reduce((sum, p) => sum + p.words, 0)
  if (total <= 0) return null

  // Each segment: how long it is, and how far round the ring it starts.
  let used = 0
  const segments = parts.map((p) => {
    const length = (p.words / total) * CIRCUMFERENCE
    const seg = { ...p, length, start: used, percent: Math.round((p.words / total) * 100) }
    used += length
    return seg
  })
  const gap = segments.length > 1 ? GAP : 0

  const summary = segments.map((s) => `${s.name} ${fmt(s.words)} words (${s.percent}%)`).join(', ')

  const arc = (s, width, colour) => (
    <circle
      key={`${s.id}-${width}`}
      cx={MID}
      cy={MID}
      r={RADIUS}
      fill="none"
      strokeWidth={width}
      style={{ stroke: colour }}
      strokeDasharray={`${Math.max(0, s.length - gap)} ${CIRCUMFERENCE}`}
      strokeDashoffset={-s.start}
      transform={`rotate(-90 ${MID} ${MID})`}
    />
  )

  return (
    <div className="donut">
      <svg
        className="donut__svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Words by project: ${summary}`}
      >
        {/* Light outline first, so a black project stays visible in dark mode (transparent in light). */}
        {segments.map((s) => arc(s, THICKNESS + 2, 'var(--ring)'))}
        {segments.map((s) => arc(s, THICKNESS, s.colour))}
        <text className="donut__total" x={MID} y={MID + 2} textAnchor="middle">
          {fmt(total)}
        </text>
        <text className="donut__label" x={MID} y={MID + 14} textAnchor="middle">
          {centreLabel}
        </text>
      </svg>

      <div className="donut__legend">
        {segments.map((s) => (
          <div className="donut__item" key={s.id}>
            <span className="dot" style={{ background: s.colour }} />
            <span>{s.name}</span>
            <span className="num donut__words">{fmt(s.words)}</span>
            <span className="mut donut__pct">{s.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
// A label and one big number. Used on Week now, and on Stats (E10).
// colour: optional project colour, shown as a dot before the label.
export default function StatCard({ label, value, highlight = false, colour }) {
  return (
    <div className={'card stat' + (highlight ? ' card--pink' : '')}>
      <div className="mut stat__label">
        {colour && <span className="dot" style={{ background: colour }} />}
        <span>{label}</span>
      </div>
      <div className="num stat__value">{value}</div>
    </div>
  )
}
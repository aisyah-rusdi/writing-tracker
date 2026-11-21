import { Fragment, useState } from 'react'

const fmt = (n) => n.toLocaleString('en-US')
const UNKNOWN = '#BDB5A3'

// weeks:   from weeklyTotals(), newest first: { start, label, total, byProject }
// total:   the grand total shown in the footer
// byId:    Map of project id -> project
// showMix: true for "All projects" (mix bar and tap-to-expand); false for one project
//
// Only the newest `recent` weeks get their own row. Older weeks fold into one
// "Earlier weeks" row (its bar is always full width: it shows the mix, not a size).
export default function WeeklyTable({ weeks, total, byId, showMix, recent = 4, subtitle }) {
  const [showAll, setShowAll] = useState(false)
  const [open, setOpen] = useState(null)

  const canFold = weeks.length > recent
  const folded = canFold && !showAll
  const shown = folded ? weeks.slice(0, recent) : weeks

  const rows = shown.map((w) => ({ key: w.start, label: w.label, total: w.total, byProject: w.byProject }))
  if (folded) {
    const byProject = {}
    let sum = 0
    for (const w of weeks.slice(recent)) {
      sum += w.total
      for (const [id, words] of Object.entries(w.byProject)) byProject[id] = (byProject[id] || 0) + words
    }
    rows.push({ key: 'earlier', label: 'Earlier weeks', total: sum, byProject, full: true })
  }

  const max = Math.max(1, ...shown.map((w) => w.total))

  // Project parts of one row, in picker order.
  const partsOf = (byProject) =>
    Object.entries(byProject)
      .map(([id, words]) => {
        const p = byId.get(id)
        return {
          id,
          words,
          name: p ? p.name : 'Unknown project',
          colour: p ? p.colour : UNKNOWN,
          order: p ? p.sortOrder || 0 : 999,
        }
      })
      .sort((a, b) => a.order - b.order)

  return (
    <section className="card scroll">
      <h2>Weekly totals</h2>
      <p className="mut wtable__sub">{subtitle}</p>

      <table className="wtable">
        <thead>
          <tr>
            <th>Week</th>
            {showMix && <th className="mixcell">Projects</th>}
            <th>Words</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const parts = partsOf(r.byProject)
            const isOpen = open === r.key
            return (
              <Fragment key={r.key}>
                <tr>
                  <td>
                    {showMix ? (
                      <button
                        type="button"
                        className="wtable__toggle"
                        aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : r.key)}
                      >
                        {r.label}
                        <span aria-hidden="true" className="mut">
                          {isOpen ? '▴' : '▾'}
                        </span>
                      </button>
                    ) : (
                      r.label
                    )}
                  </td>
                  {showMix && (
                    <td className="mixcell">
                      <div
                        className="mixbar"
                        style={{ width: `${r.full ? 100 : Math.max(10, (r.total / max) * 100)}%` }}
                      >
                        {parts.map((p) => (
                          <i key={p.id} style={{ flex: p.words, background: p.colour }} />
                        ))}
                      </div>
                    </td>
                  )}
                  <td className="num">{fmt(r.total)}</td>
                </tr>
                {showMix && isOpen && (
                  <tr className="wtable__detail">
                    <td colSpan={3}>
                      {parts.map((p) => (
                        <div className="row wtable__part" key={p.id}>
                          <span>
                            <span className="dot" style={{ background: p.colour }} /> {p.name}
                          </span>
                          <span className="num">{fmt(p.words)}</span>
                        </div>
                      ))}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            {showMix && <td />}
            <td className="num">{fmt(total)}</td>
          </tr>
        </tfoot>
      </table>

      {canFold && (
        <p className="wtable__more">
          <button type="button" className="btn sec btn--sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Fold earlier weeks' : `Show every week (${weeks.length})`}
          </button>
        </p>
      )}
    </section>
  )
}
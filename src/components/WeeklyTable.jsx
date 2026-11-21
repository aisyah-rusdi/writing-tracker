import { useEffect, useState } from 'react'

const fmt = (n) => n.toLocaleString('en-US')
const UNKNOWN = '#BDB5A3'
const PAGE_SIZE = 5 // week rows per page on small screens (the Total row is extra)

// On wide screens the number of rows follows the window height, so the Stats page
// fits without scrolling. ROW_H and OVERHEAD match the compact CSS in
// components.css (section 6): OVERHEAD is everything on the page that is not a
// week row (header, title, summary cards, table head, total row, pager).
const DESKTOP = '(min-width: 701px)'
const ROW_H = 36
const OVERHEAD = 390
const MIN_ROWS = 3
const MAX_ROWS = 12

function fitRows() {
  if (!window.matchMedia(DESKTOP).matches) return PAGE_SIZE
  const rows = Math.floor((window.innerHeight - OVERHEAD) / ROW_H)
  return Math.max(MIN_ROWS, Math.min(MAX_ROWS, rows))
}

// Re-measures when the window is resized or turned.
function useFitPageSize() {
  const [size, setSize] = useState(fitRows)
  useEffect(() => {
    const onResize = () => setSize(fitRows())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

// weeks:    from weeklyTotals(), newest first: { start, label, total, byProject }
// total:    the grand total shown in the footer (all weeks, not just this page)
// byId:     Map of project id -> project
// showMix:  true for "All projects" (shows the project mix bar); false for one project
// pageSize: optional. Leave it out to fit the window; pass a number to force one.
//
// Weeks are split into pages, newest first. Bars are scaled against the biggest
// week overall, so bars on different pages can be compared.
// Paging: "Older" (left) goes back in time, "Newer" (right) comes forward.
export default function WeeklyTable({ weeks, total, byId, showMix, subtitle, pageSize }) {
  const [page, setPage] = useState(0)
  const fitSize = useFitPageSize()
  const size = pageSize ?? fitSize

  const pageCount = Math.max(1, Math.ceil(weeks.length / size))
  const current = Math.min(page, pageCount - 1)
  const first = current * size
  const rows = weeks.slice(first, first + size)
  // On the last page, invisible rows keep the table (and the pager) at the same height.
  const blanks = pageCount > 1 ? size - rows.length : 0
  const max = Math.max(1, ...weeks.map((w) => w.total))

  // Project parts of one row, in picker order.
  const partsOf = (byProject) =>
    Object.entries(byProject)
      .map(([id, words]) => {
        const p = byId.get(id)
        return {
          id,
          words,
          colour: p ? p.colour : UNKNOWN,
          order: p ? p.sortOrder || 0 : 999,
        }
      })
      .sort((a, b) => a.order - b.order)

  return (
    <section className="card scroll">
      <div className="wtable__head">
        <h2>Weekly totals</h2>
        <p className="mut wtable__sub">{subtitle}</p>
      </div>

      <table className="wtable">
        <thead>
          <tr>
            <th>Week</th>
            {showMix && <th className="mixcell">Projects</th>}
            <th>Words</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w) => (
            <tr key={w.start}>
              <td>{w.label}</td>
              {showMix && (
                <td className="mixcell">
                  <div className="mixbar" style={{ width: `${Math.max(10, (w.total / max) * 100)}%` }}>
                    {partsOf(w.byProject).map((p) => (
                      <i key={p.id} style={{ flex: p.words, background: p.colour }} />
                    ))}
                  </div>
                </td>
              )}
              <td className="num">{fmt(w.total)}</td>
            </tr>
          ))}

          {Array.from({ length: blanks }, (_, i) => (
            <tr className="wtable__blank" key={`blank${i}`} aria-hidden="true">
              <td>&nbsp;</td>
              {showMix && (
                <td className="mixcell">
                  <div className="mixbar" />
                </td>
              )}
              <td className="num">&nbsp;</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            {showMix && <td />}
            <td className="num">{fmt(total)}</td>
          </tr>
        </tfoot>
      </table>

      {pageCount > 1 && (
        <div className="wtable__pager">
          <button
            type="button"
            className="btn sec btn--sm"
            disabled={current === pageCount - 1}
            onClick={() => setPage(current + 1)}
          >
            ‹ Older
          </button>
          <span className="mut" aria-live="polite">
            Weeks {first + 1}–{first + rows.length} of {weeks.length}
          </span>
          <button
            type="button"
            className="btn sec btn--sm"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            Newer ›
          </button>
        </div>
      )}
    </section>
  )
}
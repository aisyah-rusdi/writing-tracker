import { addMonths, endOfMonth, format, getDay, parseISO } from 'date-fns'
import { useMemo, useState } from 'react'
import DayCell from '../components/DayCell'
import DaySheet from '../components/DaySheet'
import LoadGate from '../components/LoadGate'
import Modal from '../components/Modal'
import { useEntries } from '../hooks/useEntries'
import { useToday } from '../hooks/useToday'
import { MONDAY, fillDays, formatDate, toISO, weekdayLabels } from '../lib/dates'
import { getPref, setPref } from '../lib/prefs'

const fmt = (n) => n.toLocaleString('en-US')
const PAGE_SIZES = [5, 10, 15] // days per page in the list view
const DEFAULT_PAGE_SIZE = 10
const UNKNOWN = '#BDB5A3'

// Shading: 0 nothing, then four steps by words in the day.
const levelOf = (words) => (!words ? 0 : words < 300 ? 1 : words < 700 ? 2 : words < 1000 ? 3 : 4)

function startPageSize() {
  const saved = getPref('historyPageSize', DEFAULT_PAGE_SIZE)
  return PAGE_SIZES.includes(saved) ? saved : DEFAULT_PAGE_SIZE
}

export default function History() {
  const { entries, projects, loading } = useEntries()
  const weekStartsOn = getPref('weekStart', MONDAY)

  const today = useToday()
  const currentMonth = today.slice(0, 7) + '-01'

  const [view, setView] = useState('calendar') // 'calendar' | 'list'
  const [monthStart, setMonthStart] = useState(currentMonth)
  const [selected, setSelected] = useState(null) // 'yyyy-MM-dd' while the sheet is open
  const [pageSize, setPageSize] = useState(startPageSize)
  const [page, setPage] = useState(0) // list page, 0 = newest days

  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
  const colourOf = (id) => (byId.get(id) ? byId.get(id).colour : UNKNOWN)

  /* ---------- Calendar ---------- */
  const month = parseISO(monthStart)
  const days = useMemo(
    () => fillDays(monthStart, toISO(endOfMonth(month)), entries),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthStart, entries]
  )
  const offset = (getDay(month) - weekStartsOn + 7) % 7 // blank cells before the 1st
  const labels = weekdayLabels(weekStartsOn)
  const shiftMonth = (n) => setMonthStart(toISO(addMonths(month, n)))

  /* ---------- List: every day that has entries, newest first ---------- */
  const dayList = useMemo(() => {
    const map = new Map()
    for (const e of entries) {
      if (!(e.words > 0)) continue
      if (!map.has(e.date)) map.set(e.date, { date: e.date, total: 0, ids: [] })
      const d = map.get(e.date)
      d.total += e.words
      if (!d.ids.includes(e.projectId)) d.ids.push(e.projectId)
    }
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date))
  }, [entries])

  // Paging. The page is kept in range, so deleting the last day on a page
  // moves back to the previous page instead of showing an empty one.
  const pageCount = Math.max(1, Math.ceil(dayList.length / pageSize))
  const current = Math.min(page, pageCount - 1)
  const first = current * pageSize
  const pageRows = dayList.slice(first, first + pageSize)
  // On the last page, invisible rows keep the list (and the pager) at the same height.
  const blanks = pageCount > 1 ? pageSize - pageRows.length : 0

  function changePageSize(value) {
    const n = Number(value)
    if (!PAGE_SIZES.includes(n)) return
    setPref('historyPageSize', n)
    setPageSize(n)
    setPage(0)
  }

  const subtitle =
    (view === 'calendar' ? format(month, 'MMMM yyyy') : 'All days') + ' · tap a day to add, edit or delete'

  return (
    <div className="history">
      <h1>History</h1>
      <p className="mut history__sub">{subtitle}</p>

      <LoadGate>
      <section className="card">
        <div className="row history__bar">
          <div className="chips">
            <button
              type="button"
              className={'chip' + (view === 'calendar' ? ' on' : '')}
              aria-pressed={view === 'calendar'}
              onClick={() => setView('calendar')}
            >
              Calendar
            </button>
            <button
              type="button"
              className={'chip' + (view === 'list' ? ' on' : '')}
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              List
            </button>
          </div>
          {view === 'calendar' && <span className="mut">Dashed days: not logged</span>}
          {view === 'list' && (
            <label className="hist-size mut">
              <span>Rows per page</span>
              <select
                className="pf"
                value={pageSize}
                onChange={(e) => changePageSize(e.target.value)}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {view === 'calendar' && (
          <>
            <div className="week-nav history__nav">
              <button
                type="button"
                className="btn sec"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
              >
                ‹
              </button>
              <h2 aria-live="polite">{format(month, 'MMMM yyyy')}</h2>
              <button
                type="button"
                className="btn sec"
                aria-label="Next month"
                disabled={monthStart >= currentMonth}
                onClick={() => shiftMonth(1)}
              >
                ›
              </button>
            </div>
            {monthStart !== currentMonth && (
              <p className="week-nav__today">
                <button
                  type="button"
                  className="btn sec btn--sm"
                  onClick={() => setMonthStart(currentMonth)}
                >
                  Back to this month
                </button>
              </p>
            )}

            {loading ? (
              <div className="skeleton" style={{ height: 320 }} aria-busy="true" aria-label="Loading" />
            ) : (
              <div className="cal">
                {labels.map((l, i) => (
                  <div className="h" key={i} aria-hidden="true">
                    <span className="cal__long">{l}</span>
                    <span className="cal__short">{l.slice(0, 1)}</span>
                  </div>
                ))}
                {Array.from({ length: offset }, (_, i) => (
                  <div key={`b${i}`} />
                ))}
                {days.map((d) => {
                  const isFuture = d.date > today
                  const state = d.total
                    ? `${fmt(d.total)} words`
                    : isFuture
                      ? 'not available yet'
                      : 'not logged'
                  return (
                    <DayCell
                      key={d.date}
                      day={d}
                      level={levelOf(d.total)}
                      isToday={d.date === today}
                      isSelected={d.date === selected}
                      isFuture={isFuture}
                      label={`${formatDate(d.date)}: ${state}`}
                      onSelect={setSelected}
                    />
                  )
                })}
              </div>
            )}
          </>
        )}

        {view === 'list' &&
          (loading ? (
            <div className="skeleton" style={{ height: 240 }} aria-busy="true" aria-label="Loading" />
          ) : dayList.length === 0 ? (
            <div className="empty">
              <h3>Nothing logged yet</h3>
              <p className="mut">Days you write on appear here.</p>
            </div>
          ) : (
            <>
              <div className="hist-list">
                {pageRows.map((d) => (
                  <button
                    type="button"
                    className="hist-row"
                    key={d.date}
                    onClick={() => setSelected(d.date)}
                  >
                    <span>{format(parseISO(d.date), 'EEE d MMM yyyy')}</span>
                    <span className="hist-row__dots">
                      {d.ids.map((id) => (
                        <span key={id} className="dot" style={{ background: colourOf(id) }} />
                      ))}
                    </span>
                    <span className="num hist-row__words">{fmt(d.total)}</span>
                  </button>
                ))}
                {Array.from({ length: blanks }, (_, i) => (
                  <div className="hist-row hist-row--blank" key={`blank${i}`} aria-hidden="true">
                    &nbsp;
                  </div>
                ))}
              </div>

              {pageCount > 1 && (
                <div className="history__pager">
                  <button
                    type="button"
                    className="btn sec btn--sm"
                    disabled={current === pageCount - 1}
                    onClick={() => setPage(current + 1)}
                  >
                    ‹ Older
                  </button>
                  <span className="mut" aria-live="polite">
                    Days {first + 1}–{first + pageRows.length} of {dayList.length}
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
            </>
          ))}
      </section>
      </LoadGate>

      {selected && (
        <Modal title={formatDate(selected)} onClose={() => setSelected(null)}>
          <DaySheet date={selected} />
        </Modal>
      )}
    </div>
  )
}
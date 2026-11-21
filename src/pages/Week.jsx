import { useMemo, useState } from 'react'
import LoadGate from '../components/LoadGate'
import StatCard from '../components/StatCard'
import WeekChart from '../components/WeekChart'
import { useEntries } from '../hooks/useEntries'
import { useToday } from '../hooks/useToday'
import { useWeek } from '../hooks/useWeek'
import { MONDAY, weekdayLabels } from '../lib/dates'
import { getPref } from '../lib/prefs'

const fmt = (n) => n.toLocaleString('en-US')
const UNKNOWN = '#BDB5A3' // same grey as archived/unknown dots elsewhere

export default function Week() {
  const { entries, projects, loading } = useEntries()
  const weekStartsOn = getPref('weekStart', MONDAY)
  const week = useWeek(entries, weekStartsOn)
  const [filter, setFilter] = useState('all')

  const today = useToday()
  const labels = weekdayLabels(weekStartsOn)

  const ordered = useMemo(
    () => [...projects].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    [projects]
  )
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])

  // Filter choices: active projects, plus archived ones that still have entries.
  const options = useMemo(() => {
    const used = new Set(entries.map((e) => e.projectId))
    return ordered.filter((p) => !p.archived || used.has(p.id))
  }, [ordered, entries])
  const activeFilter = options.some((p) => p.id === filter) ? filter : 'all'
  const all = activeFilter === 'all'

  // One bar per day: words per project, in picker order, for the chosen filter.
  const bars = useMemo(() => {
    const rank = new Map(ordered.map((p, i) => [p.id, i]))
    return week.days.map((d, i) => {
      const parts = Object.entries(d.byProject)
        .filter(([id, words]) => words > 0 && (all || id === activeFilter))
        .map(([id, words]) => {
          const p = byId.get(id)
          return {
            id,
            words,
            name: p ? p.name : 'Unknown project',
            colour: p ? p.colour : UNKNOWN,
          }
        })
        .sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999))
      return {
        date: d.date,
        label: labels[i],
        parts,
        total: parts.reduce((sum, p) => sum + p.words, 0),
        future: d.date > today,
      }
    })
  }, [week.days, ordered, byId, all, activeFilter, labels, today])

  const weekTotal = bars.reduce((sum, b) => sum + b.total, 0)
  const daysWritten = bars.filter((b) => b.total > 0).length

  // Words per project for the whole week (not narrowed by the filter).
  const perProject = useMemo(() => {
    const totals = {}
    for (const d of week.days) {
      for (const [id, words] of Object.entries(d.byProject)) totals[id] = (totals[id] || 0) + words
    }
    return totals
  }, [week.days])

  // Cards and legend: active projects, plus archived ones that have words this week.
  const shown = options.filter((p) => !p.archived || perProject[p.id] > 0)
  const legend = all ? shown : shown.filter((p) => p.id === activeFilter)

  return (
    <div className="week">
      <div className="week__head week__head--bar">
        <h1>Week</h1>
        <div className="week-nav week-nav--inline">
          <button
            type="button"
            className="btn sec"
            aria-label="Previous week"
            onClick={week.goPrev}
          >
            ‹
          </button>
          <h2 aria-live="polite">{week.label}</h2>
          <button
            type="button"
            className="btn sec"
            aria-label="Next week"
            disabled={!week.canGoNext}
            onClick={week.goNext}
          >
            ›
          </button>
        </div>
        <div className="week__tools">
          <button
            type="button"
            className="btn sec btn--sm"
            disabled={week.isCurrent}
            onClick={week.goToday}
          >
            This week
          </button>
          <select
            className="pf"
            aria-label="Filter by project"
            value={activeFilter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All projects</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.archived ? ' (archived)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <LoadGate>
      {loading ? (
        <div className="skeleton" style={{ height: 300 }} aria-busy="true" aria-label="Loading" />
      ) : (
        <>
          <WeekChart bars={bars} legend={legend} />

          <div className="stat-grid">
            <StatCard label="Week total" value={fmt(weekTotal)} highlight />
            {all &&
              shown.map((p) => (
                <StatCard
                  key={p.id}
                  label={p.name}
                  colour={p.colour}
                  value={fmt(perProject[p.id] || 0)}
                />
              ))}
            <StatCard label="Days written" value={daysWritten} />
          </div>
        </>
      )}
      </LoadGate>
    </div>
  )
}
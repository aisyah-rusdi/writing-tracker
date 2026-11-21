import { useMemo, useState } from 'react'
import DonutChart from '../components/DonutChart'
import LoadGate from '../components/LoadGate'
import StatCard from '../components/StatCard'
import WeeklyTable from '../components/WeeklyTable'
import { useEntries } from '../hooks/useEntries'
import { useToday } from '../hooks/useToday'
import { MONDAY } from '../lib/dates'
import { getPref } from '../lib/prefs'
import { forProject, summarize, weeklyTotals } from '../lib/stats'

const fmt = (n) => n.toLocaleString('en-US')

export default function Stats() {
  const { entries, projects, loading } = useEntries()
  const weekStartsOn = getPref('weekStart', MONDAY)
  const [filter, setFilter] = useState('all')

  const today = useToday()

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

  const filtered = useMemo(() => forProject(entries, activeFilter), [entries, activeFilter])
  const summary = useMemo(() => summarize(filtered, today), [filtered, today])
  const weeks = useMemo(() => weeklyTotals(filtered, weekStartsOn), [filtered, weekStartsOn])

  // Words per project for the donut, in picker order. Projects with no words are left out.
  const byProject = useMemo(() => {
    const totals = {}
    for (const e of filtered) totals[e.projectId] = (totals[e.projectId] || 0) + e.words
    return ordered
      .filter((p) => totals[p.id] > 0)
      .map((p) => ({ id: p.id, name: p.name, colour: p.colour, words: totals[p.id] }))
  }, [filtered, ordered])

  // A donut with one slice says nothing, so it only shows when projects share the words.
  const showDonut = all && byProject.length > 1

  const streak = summary.currentStreak
  const selectedName = byId.get(activeFilter)?.name

  return (
    <div className="stats">
      <div className="week__head">
        <h1>Stats</h1>
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

      <LoadGate>
        {loading ? (
          <div className="skeleton stats__skeleton" aria-busy="true" aria-label="Loading" />
        ) : (
          <>
            <div className="stat-grid stats__summary">
              <StatCard label="Grand total" value={fmt(summary.grandTotal)} highlight />
              <StatCard label="Average per writing day" value={fmt(summary.average)} />
              <StatCard label="Best day" value={summary.best ? fmt(summary.best.words) : '–'} />
              <StatCard label="Current streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} />
            </div>

            {filtered.length === 0 ? (
              <section className="card empty">
                <h3>Nothing to show yet</h3>
                <p className="mut">
                  {all
                    ? 'Log some words on Today and your stats appear here.'
                    : `No words logged for ${selectedName} yet.`}
                </p>
              </section>
            ) : (
              // Table takes two thirds and the donut one third. Without a donut, the table is full width.
              <div className={'stats-grid' + (showDonut ? '' : ' stats-grid--solo')}>
                <WeeklyTable
                  key={activeFilter} // new filter: back to page 1
                  weeks={weeks}
                  total={summary.grandTotal}
                  byId={byId}
                  showMix={all}
                  subtitle={all ? 'All projects' : `${selectedName} only`}
                />

                {showDonut && (
                  <section className="card">
                    <h2>By project</h2>
                    <DonutChart parts={byProject} />
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </LoadGate>
    </div>
  )
}
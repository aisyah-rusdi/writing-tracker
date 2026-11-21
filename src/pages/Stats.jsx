import { format, parseISO } from 'date-fns'
import { useMemo, useState } from 'react'
import LoadGate from '../components/LoadGate'
import StatCard from '../components/StatCard'
import WeeklyTable from '../components/WeeklyTable'
import { useEntries } from '../hooks/useEntries'
import { useToday } from '../hooks/useToday'
import { MONDAY } from '../lib/dates'
import { getPref } from '../lib/prefs'
import { findGaps, forProject, goalProgress, summarize, weeklyTotals } from '../lib/stats'

const fmt = (n) => n.toLocaleString('en-US')
const RECENT = 4 // weeks with their own row / bar before older ones fold
const MAX_GAPS = 5 // most recent gaps listed

export default function Stats() {
  const { entries, projects, loading } = useEntries()
  const weekStartsOn = getPref('weekStart', MONDAY)
  const [filter, setFilter] = useState('all')

  const today = useToday()
  const thisYear = today.slice(0, 4)
  const fmtDay = (iso) => format(parseISO(iso), iso.slice(0, 4) === thisYear ? 'd MMM' : 'd MMM yyyy')

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
  const gaps = useMemo(() => findGaps(filtered), [filtered])

  const recent = weeks.slice(0, RECENT).reverse() // oldest to newest, like a timeline
  const recentMax = Math.max(1, ...recent.map((w) => w.total))
  const shownGaps = gaps.slice(-MAX_GAPS)

  const goalProjects = all ? ordered.filter((p) => !p.archived) : ordered.filter((p) => p.id === activeFilter)

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
                {all ? 'Log some words on Today and your stats appear here.' : `No words logged for ${selectedName} yet.`}
              </p>
            </section>
          ) : (
            <div className="stats-grid">
              <WeeklyTable
                weeks={weeks}
                total={summary.grandTotal}
                byId={byId}
                showMix={all}
                recent={RECENT}
                subtitle={all ? 'All projects · tap a week for the breakdown' : `${selectedName} only`}
              />

              <div className="stack">
                <section className="card">
                  <h2>Recent weeks</h2>
                  {recent.map((w) => (
                    <div className="recent-week" key={w.start}>
                      <div className="row mut">
                        <span>{w.label}</span>
                        <span className="num">{fmt(w.total)}</span>
                      </div>
                      <div className="bar">
                        <i style={{ width: `${(w.total / recentMax) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </section>

                <section className="card">
                  <h2>Gaps</h2>
                  {shownGaps.length === 0 ? (
                    <p className="mut stats__note">No gaps of 3 days or more.</p>
                  ) : (
                    <div className="list-plain">
                      {shownGaps.map((g) => (
                        <div className="entry" key={g.from}>
                          <span>
                            {fmtDay(g.from)} – {fmtDay(g.to)}
                          </span>
                          <span className="num entry__words">{g.days} days</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {gaps.length > shownGaps.length && (
                    <p className="mut stats__note">and {gaps.length - shownGaps.length} earlier.</p>
                  )}
                </section>

                <section className="card">
                  <h2>Goals</h2>
                  {goalProjects.length === 0 ? (
                    <p className="mut stats__note">No projects yet.</p>
                  ) : (
                    <div className="list-plain">
                      {goalProjects.map((p) => (
                        <GoalRow key={p.id} project={p} entries={entries} today={today} weekStartsOn={weekStartsOn} />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}
        </>
      )}
      </LoadGate>
    </div>
  )
}

function GoalRow({ project, entries, today, weekStartsOn }) {
  const goals = []
  if (project.dailyGoal) goals.push(`${fmt(project.dailyGoal)} a day`)
  if (project.weeklyGoal) goals.push(`${fmt(project.weeklyGoal)} a week`)

  const { day, week } = goalProgress(entries, project, today, weekStartsOn)
  const progress = []
  if (day) progress.push(`Today ${fmt(day.words)} of ${fmt(day.goal)}`)
  if (week) progress.push(`This week ${fmt(week.words)} of ${fmt(week.goal)}`)

  return (
    <div className="entry goal-row">
      <span className="dot" style={{ background: project.colour }} />
      <div>
        <div>{project.name}</div>
        <div className="mut">{goals.length ? goals.join(', ') : 'No goal yet'}</div>
        {progress.length > 0 && <div className="mut">{progress.join(' · ')}</div>}
      </div>
    </div>
  )
}
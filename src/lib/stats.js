// src/lib/stats.js
// The stats engine (E6). Pure functions: entries in, numbers out. No React, no storage.
//
// Every function takes a plain list of entries ({ date, projectId, words }) and
// never filters by project itself. To filter, wrap the list first:
//
//   const mine = forProject(entries, 'p1')   // one project
//   const all  = forProject(entries, 'all')  // everything (same as no filter)
//   summarize(mine, today)
//
// Entries that are still syncing or failed are counted too, because they are
// words she has written and they are on screen.

import { addDays, parseISO } from 'date-fns'
import { MONDAY, daysBetween, formatWeekRange, toISO, weekDays, weekStartOf } from './dates'

const addDaysISO = (iso, n) => toISO(addDays(parseISO(iso), n))

/* ------------------------------------------------------------------ */
/* Filtering and basic sums                                            */
/* ------------------------------------------------------------------ */

// projectId: a project id, or 'all' / null / undefined for no filter.
export function forProject(entries, projectId) {
  if (!projectId || projectId === 'all') return entries
  return entries.filter((e) => e.projectId === projectId)
}

// Total words for one project between two dates (inclusive, 'yyyy-MM-dd').
export function sumWords(entries, projectId, fromISO, toISO) {
  let total = 0
  for (const e of entries) {
    if (e.projectId === projectId && e.date >= fromISO && e.date <= toISO) total += e.words
  }
  return total
}

export function totalWords(entries) {
  return entries.reduce((sum, e) => sum + e.words, 0)
}

// Map of 'yyyy-MM-dd' -> words that day. Only days with words appear.
export function dailyTotals(entries) {
  const days = new Map()
  for (const e of entries) {
    if (!(e.words > 0)) continue
    days.set(e.date, (days.get(e.date) || 0) + e.words)
  }
  return days
}

/* ------------------------------------------------------------------ */
/* Averages and best day                                               */
/* ------------------------------------------------------------------ */

// -> { writingDays, average, best: { date, words } | null }
// average = total words / days with any words, rounded (0 when nothing is logged).
// best = the day with the most words in total (ties go to the earlier day).
export function dayStats(entries) {
  const days = dailyTotals(entries)
  let total = 0
  let best = null
  for (const [date, words] of days) {
    total += words
    if (!best || words > best.words || (words === best.words && date < best.date)) {
      best = { date, words }
    }
  }
  return {
    writingDays: days.size,
    average: days.size ? Math.round(total / days.size) : 0,
    best,
  }
}

/* ------------------------------------------------------------------ */
/* Streaks                                                             */
/* ------------------------------------------------------------------ */

// current: consecutive written days ending today. If today has nothing yet, the
//          streak is counted back from yesterday, so it only breaks once a whole
//          day has passed without writing.
// longest: the longest run of consecutive written days ever.
export function streaks(entries, today) {
  const days = dailyTotals(entries)

  let current = 0
  let cursor = days.has(today) ? today : addDaysISO(today, -1)
  while (days.has(cursor)) {
    current++
    cursor = addDaysISO(cursor, -1)
  }

  let longest = 0
  let run = 0
  let previous = null
  for (const date of [...days.keys()].sort()) {
    run = previous && daysBetween(previous, date) === 1 ? run + 1 : 1
    if (run > longest) longest = run
    previous = date
  }

  return { current, longest }
}

/* ------------------------------------------------------------------ */
/* Weekly totals                                                       */
/* ------------------------------------------------------------------ */

// One record per week that has words, newest first:
//   { start, label, total, byProject: { [projectId]: words } }
// Weeks with no words are left out. The Stats page can fold older ones into
// "Earlier weeks" however it likes.
export function weeklyTotals(entries, weekStartsOn = MONDAY) {
  const weeks = new Map()
  for (const e of entries) {
    if (!(e.words > 0)) continue
    const start = weekStartOf(e.date, weekStartsOn)
    if (!weeks.has(start)) {
      weeks.set(start, { start, label: formatWeekRange(start), total: 0, byProject: {} })
    }
    const w = weeks.get(start)
    w.total += e.words
    w.byProject[e.projectId] = (w.byProject[e.projectId] || 0) + e.words
  }
  return [...weeks.values()].sort((a, b) => b.start.localeCompare(a.start))
}

/* ------------------------------------------------------------------ */
/* Gaps                                                                */
/* ------------------------------------------------------------------ */

// Runs of days with no words, between two days that do have words, oldest first:
//   { from, to, days }
// Only runs of minDays or more are listed (default 3), so a single skipped day
// is not called a gap. The stretch since the last entry is not a gap: today is
// still in progress.
export function findGaps(entries, { minDays = 3 } = {}) {
  const dates = [...dailyTotals(entries).keys()].sort()
  const gaps = []
  for (let i = 1; i < dates.length; i++) {
    const days = daysBetween(dates[i - 1], dates[i]) - 1
    if (days >= minDays) {
      gaps.push({ from: addDaysISO(dates[i - 1], 1), to: addDaysISO(dates[i], -1), days })
    }
  }
  return gaps
}

/* ------------------------------------------------------------------ */
/* Goal progress                                                       */
/* ------------------------------------------------------------------ */

// For one project (with dailyGoal / weeklyGoal, blank or null = no goal):
//   { day: { goal, words, percent, reached } | null, week: { ... } | null }
// percent is capped at 100. A goal that is not set gives null.
export function goalProgress(entries, project, today, weekStartsOn = MONDAY) {
  if (!project) return { day: null, week: null }
  const weekStart = weekStartOf(today, weekStartsOn)
  const weekEnd = weekDays(weekStart)[6]

  const make = (goal, words) =>
    goal
      ? {
          goal,
          words,
          percent: Math.min(100, Math.round((words / goal) * 100)),
          reached: words >= goal,
        }
      : null

  return {
    day: make(project.dailyGoal, sumWords(entries, project.id, today, today)),
    week: make(project.weeklyGoal, sumWords(entries, project.id, weekStart, weekEnd)),
  }
}

/* ------------------------------------------------------------------ */
/* Everything the summary cards need                                   */
/* ------------------------------------------------------------------ */

// -> { grandTotal, writingDays, average, best, currentStreak, longestStreak }
export function summarize(entries, today) {
  const { writingDays, average, best } = dayStats(entries)
  const { current, longest } = streaks(entries, today)
  return {
    grandTotal: totalWords(entries),
    writingDays,
    average,
    best,
    currentStreak: current,
    longestStreak: longest,
  }
}
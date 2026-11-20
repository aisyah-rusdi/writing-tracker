// src/lib/celebration.js
// Decides when a goal celebration fires, and picks the quote.
//
// Rules (from the plan):
// - A save takes a project's total for the day, or for the week, to or past its goal.
// - Each goal celebrates once per day or week, not on every later save.
// - Only where a goal exists (no goal = no celebration).
// - Never on import: the import code does not call this.

import messages from '../data/celebrationMessages.json'
import { getPref, setPref } from './prefs'
import { sumWords } from './stats'

const KEEP_LAST = 60

export function pickQuote() {
  return messages[Math.floor(Math.random() * messages.length)]
}

// Call this BEFORE adding the new entry to `entries`.
// Returns 'week', 'day' or null. When it returns something, the goal(s) it
// covers are remembered, so the same goal never celebrates twice.
export function claimGoalCelebration({ entries, project, words, date, weekStart, weekEnd }) {
  if (!project) return null
  const done = getPref('celebrated', [])

  const crossed = (goal, from, to, key) => {
    if (!goal || done.includes(key)) return false
    const before = sumWords(entries, project.id, from, to)
    return before < goal && before + words >= goal
  }

  const dayKey = `${project.id}:day:${date}`
  const weekKey = `${project.id}:week:${weekStart}`
  const day = crossed(project.dailyGoal, date, date, dayKey)
  const week = crossed(project.weeklyGoal, weekStart, weekEnd, weekKey)
  if (!day && !week) return null

  const keys = [day && dayKey, week && weekKey].filter(Boolean)
  setPref('celebrated', [...done, ...keys].slice(-KEEP_LAST))

  // If both goals are hit by the same save, the bigger one (the week) is shown.
  return week ? 'week' : 'day'
}
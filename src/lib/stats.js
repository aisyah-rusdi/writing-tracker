// src/lib/stats.js
// Only what the Today page needs for now. E6 (stats engine) will add the rest:
// averages, best day, streaks, gaps, goal progress.

// Total words for one project between two dates (inclusive, 'yyyy-MM-dd').
export function sumWords(entries, projectId, fromISO, toISO) {
  let total = 0
  for (const e of entries) {
    if (e.projectId === projectId && e.date >= fromISO && e.date <= toISO) total += e.words
  }
  return total
}
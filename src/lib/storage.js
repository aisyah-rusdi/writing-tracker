// src/lib/storage.js
// Local copy of the sheet's data, kept only in this browser (E4).
//
// Two things are stored:
//   wt-cache    the last entries and projects the sheet sent, so pages open instantly
//   wt-pending  entries made on this device that the sheet has not confirmed yet
//
// Every call is safe when storage is blocked (private browsing): reads come back
// empty and writes are skipped, so the app still works, it just won't remember.

const CACHE_KEY = 'wt-cache'
const PENDING_KEY = 'wt-pending'

function read(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return value === null || value === undefined ? fallback : value
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage blocked or full: nothing to do.
  }
}

// -> { entries, projects }
export function loadCache() {
  const c = read(CACHE_KEY, {})
  return {
    entries: Array.isArray(c.entries) ? c.entries : [],
    projects: Array.isArray(c.projects) ? c.projects : [],
  }
}

export function saveCache({ entries, projects }) {
  write(CACHE_KEY, { entries, projects, savedAt: Date.now() })
}

// Called when the connection is removed, so another sheet never shows old data.
export function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // nothing to clear
  }
}

// -> [entry] still waiting to reach the sheet
export function loadPending() {
  const p = read(PENDING_KEY, [])
  return Array.isArray(p) ? p : []
}

export function savePending(list) {
  write(PENDING_KEY, list)
}
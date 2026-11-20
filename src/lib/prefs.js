// src/lib/prefs.js
// Small per-device preferences, kept only in this browser's local storage
// (separate from the connection settings in api.js).
//
// Used for: the last project picked, the goal celebration on/off switch, and
// which goal celebrations have already been shown. E11 (Settings) will reuse it.

const STORAGE_KEY = 'wt-prefs'

function read() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

export function getPref(name, fallback) {
  const value = read()[name]
  return value === undefined ? fallback : value
}

export function setPref(name, value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...read(), [name]: value }))
  } catch {
    // Storage blocked (for example private browsing): preferences just won't stick.
  }
}
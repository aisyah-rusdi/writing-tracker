// src/lib/theme.js
// Applies the chosen theme. 'system' follows the device; 'light' and 'dark' force it.
// tokens.css reads the data-theme attribute on <html>.
//
// Every change (including the device switching between light and dark while the
// choice is 'system') also:
//   - updates the browser bar colour (<meta name="theme-color">), and
//   - fires a 'wt-theme' event, so the header toggle can redraw its icon.
import { getPref } from './prefs'

const DARK_QUERY = '(prefers-color-scheme: dark)'
let watching = false

// Is the page dark right now, whatever the reason (forced or from the device)?
export function isDark() {
  const forced = document.documentElement.dataset.theme
  if (forced === 'dark') return true
  if (forced === 'light') return false
  return window.matchMedia(DARK_QUERY).matches
}

function announce() {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    if (bg) meta.setAttribute('content', bg)
  }
  window.dispatchEvent(new Event('wt-theme'))
}

export function applyTheme(theme = getPref('theme', 'system')) {
  const root = document.documentElement
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme
  else delete root.dataset.theme

  if (!watching) {
    watching = true
    window.matchMedia(DARK_QUERY).addEventListener('change', announce)
  }
  announce()
}
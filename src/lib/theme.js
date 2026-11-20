// src/lib/theme.js
// Applies the chosen theme. 'system' follows the device; 'light' and 'dark' force it.
// tokens.css reads the data-theme attribute on <html>.
import { getPref } from './prefs'

export function applyTheme(theme = getPref('theme', 'system')) {
  const root = document.documentElement
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme
  else delete root.dataset.theme
}
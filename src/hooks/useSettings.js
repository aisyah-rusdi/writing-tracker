// src/hooks/useSettings.js
// Per-device preferences: week start, theme, goal celebration.
// Kept in this browser only (see lib/prefs.js). Changes apply straight away.
import { useState } from 'react'
import { MONDAY } from '../lib/dates'
import { getPref, setPref } from '../lib/prefs'
import { applyTheme } from '../lib/theme'

// Values use date-fns numbering: 0 = Sunday, 1 = Monday, 6 = Saturday.
export const WEEK_STARTS = [
  { value: 1, label: 'Monday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
]

export function useSettings() {
  const [settings, setSettings] = useState(() => ({
    weekStart: getPref('weekStart', MONDAY),
    theme: getPref('theme', 'system'),
    celebration: getPref('celebration', true),
  }))

  function change(name, value) {
    setPref(name, value)
    setSettings((s) => ({ ...s, [name]: value }))
    if (name === 'theme') applyTheme(value)
  }

  return [settings, change]
}
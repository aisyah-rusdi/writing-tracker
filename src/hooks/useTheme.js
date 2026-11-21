// src/hooks/useTheme.js
// For the sun/moon button in the header.
//   const { dark, toggle } = useTheme()
// toggle() switches between Light and Dark and remembers the choice. The Theme
// select in Settings stays the place to go back to "System".
import { useEffect, useState } from 'react'
import { setPref } from '../lib/prefs'
import { applyTheme, isDark } from '../lib/theme'

export function useTheme() {
  const [dark, setDark] = useState(isDark)

  // Follows every change: this button, the Settings select, or the device.
  useEffect(() => {
    const update = () => setDark(isDark())
    window.addEventListener('wt-theme', update)
    return () => window.removeEventListener('wt-theme', update)
  }, [])

  function toggle() {
    const next = isDark() ? 'light' : 'dark'
    setPref('theme', next)
    applyTheme(next)
  }

  return { dark, toggle }
}
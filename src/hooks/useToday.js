// src/hooks/useToday.js
// Today's date as 'yyyy-MM-dd', kept correct while the page stays open.
//
// Without this, a tab left open overnight keeps showing yesterday as "today"
// until something else makes it redraw. This hook redraws the page:
//   - just after local midnight (a timer), and
//   - when the tab or phone comes back into view (timers are paused or slowed
//     while a page is in the background, so the timer alone is not enough).
// Between those moments it returns the same string, so nothing redraws.
import { useEffect, useState } from 'react'
import { todayISO } from '../lib/dates'

export function useToday() {
  const [today, setToday] = useState(todayISO)

  useEffect(() => {
    let timer
    const check = () => setToday(todayISO()) // same value = no redraw

    const schedule = () => {
      clearTimeout(timer)
      const now = new Date()
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1)
      timer = setTimeout(() => {
        check()
        schedule()
      }, nextMidnight - now)
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        check()
        schedule()
      }
    }

    schedule()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
    }
  }, [])

  return today
}
// hooks/useWeek.js
// Week navigation for the Week page (and anything else that shows one week).
//
// Usage:
//   const week = useWeek(entries, weekStartsOn);
//   week.label      -> "16 – 22 Nov"
//   week.days       -> 7 records: { date, total, byProject, entries, logged }
//   week.total      -> words in the week (all projects)
//   week.daysWritten
//   week.goPrev(), week.goNext(), week.goToday()
//   week.isCurrent, week.canGoNext

import { useMemo, useState } from 'react';
import {
  MONDAY,
  fillWeek,
  formatWeekRange,
  shiftWeek,
  todayISO,
  weekStartOf,
} from '../lib/dates';

export function useWeek(entries, weekStartsOn = MONDAY) {
  // Start on the week that contains today.
  const [weekStart, setWeekStart] = useState(() => weekStartOf(todayISO(), weekStartsOn));

  // If the week-start setting changes, snap the view to the current week
  // (an old week start would no longer line up with the new setting).
  const [lastSetting, setLastSetting] = useState(weekStartsOn);
  if (lastSetting !== weekStartsOn) {
    setLastSetting(weekStartsOn);
    setWeekStart(weekStartOf(todayISO(), weekStartsOn));
  }

  const currentStart = weekStartOf(todayISO(), weekStartsOn);

  return useMemo(() => {
    const days = fillWeek(weekStart, entries);
    return {
      start: weekStart,
      label: formatWeekRange(weekStart),
      days,
      total: days.reduce((sum, d) => sum + d.total, 0),
      daysWritten: days.filter((d) => d.logged).length,
      isCurrent: weekStart === currentStart,
      canGoNext: weekStart < currentStart, // no browsing into future weeks
      goPrev: () => setWeekStart((s) => shiftWeek(s, -1)),
      goNext: () => setWeekStart((s) => (s < currentStart ? shiftWeek(s, 1) : s)),
      goToday: () => setWeekStart(currentStart),
    };
  }, [weekStart, entries, currentStart]);
}
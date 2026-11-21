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
//
// While the current week is showing, it keeps following the current week: if the
// page is open over midnight on a week boundary, it moves on by itself. Once you
// browse to an older week, it stays there.

import { useMemo, useState } from 'react';
import {
  MONDAY,
  fillWeek,
  formatWeekRange,
  shiftWeek,
  weekStartOf,
} from '../lib/dates';
import { useToday } from './useToday';

export function useWeek(entries, weekStartsOn = MONDAY) {
  const today = useToday();
  const currentStart = weekStartOf(today, weekStartsOn);

  // null means "the current week, whichever that is".
  const [picked, setPicked] = useState(null);

  // If the week-start setting changes, go back to the current week
  // (an old week start would no longer line up with the new setting).
  const [lastSetting, setLastSetting] = useState(weekStartsOn);
  if (lastSetting !== weekStartsOn) {
    setLastSetting(weekStartsOn);
    setPicked(null);
  }

  const weekStart = picked ?? currentStart;

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
      goPrev: () => setPicked(shiftWeek(weekStart, -1)),
      goNext: () => {
        if (weekStart >= currentStart) return;
        const next = shiftWeek(weekStart, 1);
        setPicked(next >= currentStart ? null : next);
      },
      goToday: () => setPicked(null),
    };
  }, [weekStart, entries, currentStart]);
}
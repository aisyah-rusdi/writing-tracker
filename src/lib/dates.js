// lib/dates.js
// All dates in the app are plain "YYYY-MM-DD" strings in the device's local time.
// This avoids time zone shifts (a Date at midnight can land on the wrong day when
// converted to UTC). We only turn a string into a Date when we need to calculate.

import {
  addDays,
  addWeeks,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameYear,
  parseISO,
  startOfWeek,
} from 'date-fns';

// weekStartsOn uses date-fns numbering: 0 = Sunday, 1 = Monday, ... 6 = Saturday.
export const MONDAY = 1;

const ISO = 'yyyy-MM-dd';

/** Date object -> "YYYY-MM-DD" (local) */
export function toISO(date) {
  return format(date, ISO);
}

/** Today's date as "YYYY-MM-DD" (local) */
export function todayISO() {
  return toISO(new Date());
}

/** "YYYY-MM-DD" of the first day of the week that contains `iso` */
export function weekStartOf(iso, weekStartsOn = MONDAY) {
  return toISO(startOfWeek(parseISO(iso), { weekStartsOn }));
}

/** The seven "YYYY-MM-DD" days of the week that starts on `startISO` */
export function weekDays(startISO) {
  const start = parseISO(startISO);
  return eachDayOfInterval({ start, end: addDays(start, 6) }).map(toISO);
}

/** Move a week start forward (n > 0) or back (n < 0) by n weeks */
export function shiftWeek(startISO, n) {
  return toISO(addWeeks(parseISO(startISO), n));
}

/** Whole days between two ISO dates (b - a) */
export function daysBetween(aISO, bISO) {
  return differenceInCalendarDays(parseISO(bISO), parseISO(aISO));
}

/** Short weekday names in the order of the week, e.g. ["Mon","Tue",...] */
export function weekdayLabels(weekStartsOn = MONDAY) {
  const start = parseISO(weekStartOf('2026-11-16', weekStartsOn)); // any known week
  return weekDays(toISO(start)).map((d) => format(parseISO(d), 'EEE'));
}

// ---------- Formatting ----------

/** "Friday, 20 Nov 2026" (Today page heading) */
export function formatLongDate(iso) {
  return format(parseISO(iso), 'EEEE, d MMM yyyy');
}

/** "20 Nov 2026" (day sheet title) */
export function formatDate(iso) {
  return format(parseISO(iso), 'd MMM yyyy');
}

/**
 * Week range label, matching the storyboards:
 *   same month:    "16 – 22 Nov"
 *   across months: "26 Oct – 1 Nov"
 *   across years:  "28 Dec 2026 – 3 Jan 2027"
 */
export function formatWeekRange(startISO) {
  const start = parseISO(startISO);
  const end = addDays(start, 6);
  if (!isSameYear(start, end)) {
    return `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`;
  }
  if (!isSameMonth(start, end)) {
    return `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`;
  }
  return `${format(start, 'd')} – ${format(end, 'd MMM')}`;
}

// ---------- Filling in unlogged days ----------

/**
 * Build one record per day between startISO and endISO (inclusive), including days
 * with no entries. Nothing is written to the sheet for unlogged days; they only
 * exist here so charts and calendars have every day to draw.
 *
 * entries: [{ id, date, projectId, words }]
 * returns: [{ date, total, byProject: { [projectId]: words }, entries: [...], logged }]
 */
export function fillDays(startISO, endISO, entries) {
  const byDate = new Map();
  for (const e of entries) {
    if (e.date < startISO || e.date > endISO) continue; // ISO strings sort correctly
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  }

  const days = eachDayOfInterval({ start: parseISO(startISO), end: parseISO(endISO) });
  return days.map((d) => {
    const date = toISO(d);
    const list = byDate.get(date) || [];
    const byProject = {};
    let total = 0;
    for (const e of list) {
      byProject[e.projectId] = (byProject[e.projectId] || 0) + e.words;
      total += e.words;
    }
    return { date, total, byProject, entries: list, logged: list.length > 0 };
  });
}

/** fillDays for one week (7 records, in week order) */
export function fillWeek(startISO, entries) {
  return fillDays(startISO, weekDays(startISO)[6], entries);
}
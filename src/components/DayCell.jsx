const fmt = (n) => n.toLocaleString('en-US')

// One day in the History calendar.
// level: 0 (nothing) to 4, from how many words that day.
// Days after today can't be logged, so they are disabled and plain.
export default function DayCell({ day, level, isToday, isSelected, isFuture, label, onSelect }) {
  const classes = ['day']
  if (level) classes.push(`l${level}`)
  else if (!isFuture) classes.push('un') // dashed: past day with nothing logged
  if (isToday) classes.push('today')
  if (isSelected) classes.push('sel')

  return (
    <button
      type="button"
      className={classes.join(' ')}
      disabled={isFuture}
      aria-label={label}
      aria-pressed={isSelected}
      onClick={() => onSelect(day.date)}
    >
      <b>{parseInt(day.date.slice(8), 10)}</b>
      <span className="num">{day.total ? fmt(day.total) : isFuture ? '' : '–'}</span>
    </button>
  )
}
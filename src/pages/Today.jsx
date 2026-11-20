import { useEffect, useMemo, useRef, useState } from 'react'
import Confetti from '../components/Confetti'
import EntryRow from '../components/EntryRow'
import ProjectPicker from '../components/ProjectPicker'
import Toast from '../components/Toast'
import WordInput from '../components/WordInput'
import { ApiError, describeError } from '../lib/api'
import { claimGoalCelebration, pickQuote } from '../lib/celebration'
import {
  MONDAY,
  formatLongDate,
  formatWeekRange,
  todayISO,
  weekDays,
  weekStartOf,
} from '../lib/dates'
import { getPref, setPref } from '../lib/prefs'
import { sumWords } from '../lib/stats'
import { useEntries } from '../hooks/useEntries'

const fmt = (n) => n.toLocaleString('en-US')

export default function Today({ onOpenSettings = () => (window.location.hash = '#/settings') }) {
  const { entries, projects, loading, error, refresh, save, retry } = useEntries()

  const [projectId, setProjectId] = useState(() => getPref('lastProject', null))
  const [words, setWords] = useState('')
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [toast, setToast] = useState('')
  const [celebration, setCelebration] = useState(null) // inline card on mobile
  const [confetti, setConfetti] = useState(false)

  // Timers are cleared when the page closes, so nothing fires on a missing page.
  const timers = useRef([])
  const toastTimer = useRef(null)
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
      clearTimeout(toastTimer.current)
    },
    []
  )

  const flash = (message, ms = 2800) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), ms)
  }

  // Active projects in picker order. The last one used is preselected; the very
  // first time it is the first project (Project: Brotherhood).
  const active = useMemo(
    () => projects.filter((p) => !p.archived).sort((a, b) => a.sortOrder - b.sortOrder),
    [projects]
  )
  const selected = active.find((p) => p.id === projectId) || active[0]

  const today = todayISO()
  const weekStart = weekStartOf(today, getPref('weekStart', MONDAY))
  const weekEnd = weekDays(weekStart)[6]

  const todayEntries = entries.filter((e) => e.date === today)
  const todayTotal = todayEntries.reduce((sum, e) => sum + e.words, 0)
  const projectById = (id) => projects.find((p) => p.id === id)

  const amount = parseInt(words, 10)
  const canSave = Boolean(selected) && amount >= 1

  function celebrate(kind) {
    if (!getPref('celebration', true)) return
    const quote = pickQuote()
    const mobile = window.matchMedia('(max-width: 700px)').matches
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    later(() => {
      if (!reduceMotion) {
        setConfetti(true)
        later(() => setConfetti(false), 3000)
      }
      if (mobile) {
        setCelebration({
          label: kind === 'week' ? 'Weekly goal reached' : 'Daily goal reached',
          ...quote,
        })
        later(() => setCelebration(null), 6000)
      } else {
        flash(`${quote.text} — ${quote.author}`, 5000)
      }
    }, 700)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!canSave) return

    // Check the goals first, against the entries as they are before this save.
    const kind = claimGoalCelebration({
      entries,
      project: selected,
      words: amount,
      date: today,
      weekStart,
      weekEnd,
    })

    setPref('lastProject', selected.id)
    save({ projectId: selected.id, words: amount, note: note.trim(), date: today })
    setWords('')
    setNote('')
    setShowNote(false)
    flash(`Saved +${fmt(amount)} words`)
    if (kind) celebrate(kind)
  }

  // ----- Progress card (follows the selected project) -----
  const weekWords = selected ? sumWords(entries, selected.id, weekStart, weekEnd) : 0
  const dayWords = selected ? sumWords(entries, selected.id, today, today) : 0
  const dayGoal = selected && selected.dailyGoal
  const weekGoal = selected && selected.weeklyGoal

  let dayLine = 'No goal yet'
  if (dayGoal) {
    dayLine = `Today: ${fmt(dayWords)} of ${fmt(dayGoal)} words${dayWords >= dayGoal ? ' – goal reached' : ''}`
  } else if (weekGoal) {
    dayLine = `Today: ${fmt(dayWords)} words`
  }

  // ----- Banner for load and save problems -----
  let banner = null
  if (error) {
    const { title, message } = describeError(error)
    const code = error instanceof ApiError ? error.code : ''
    const needsSettings = code === 'NOT_CONFIGURED' || code === 'BAD_PASSPHRASE'
    banner = {
      title,
      message,
      info: code === 'NOT_CONFIGURED',
      actionLabel: needsSettings ? 'Open Settings' : 'Try again',
      action: needsSettings ? onOpenSettings : refresh,
    }
  }

  return (
    <div className="today">
      <h1>{formatLongDate(today)}</h1>
      <p className="mut today__week">Week of {formatWeekRange(weekStart)}</p>

      {banner && (
        <div className={'banner ' + (banner.info ? 'banner--info' : 'banner--error')} role="alert">
          <b>{banner.title}</b>
          {banner.message}
          <div>
            <button type="button" className="btn sec" onClick={banner.action}>
              {banner.actionLabel}
            </button>
          </div>
        </div>
      )}

      {celebration && (
        <section className="card card--pink celebration" role="status">
          <div className="num">{celebration.label}</div>
          <blockquote className="celebration__quote">“{celebration.text}”</blockquote>
          <div className="mut">{celebration.author}</div>
        </section>
      )}

      {loading ? (
        <TodaySkeleton />
      ) : (
        <div className="today-grid">
          <form className="card" onSubmit={handleSubmit}>
            <label className="mut" htmlFor="words">
              How many words today?
            </label>
            <WordInput value={words} onChange={setWords} />

            <div className="mut today__label">Project</div>
            <ProjectPicker
              projects={active}
              value={selected ? selected.id : ''}
              onChange={(id) => setProjectId(id)}
            />

            <p>
              <button
                type="button"
                className="chip chip--dashed"
                onClick={() => setShowNote((v) => !v)}
              >
                {showNote ? 'Hide note' : 'Add a note'}
              </button>
            </p>
            {showNote && (
              <label className="field">
                <span>Note</span>
                <input
                  value={note}
                  maxLength={200}
                  placeholder="e.g. restructuring the plot"
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            )}

            <button type="submit" className="btn" disabled={!canSave}>
              Save words
            </button>
          </form>

          <div className="stack">
            <section className="card">
              <div className="row">
                <h2>Today</h2>
                <span className="num today__total">{fmt(todayTotal)}</span>
              </div>
              {todayEntries.length === 0 ? (
                <div className="empty">
                  <h3>Nothing logged yet</h3>
                  <p className="mut">Type a number above and save. Your first words land here.</p>
                </div>
              ) : (
                todayEntries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    project={projectById(entry.projectId)}
                    onRetry={retry}
                  />
                ))
              )}
            </section>

            {selected && (
              <section className="card">
                <h2>This week</h2>
                <p className="mut today__sub">
                  {selected.name}, {formatWeekRange(weekStart)}
                </p>
                <div className="row today__weekrow">
                  <span className="num today__weeknum">{fmt(weekWords)}</span>
                  <span className="mut">{weekGoal ? `of ${fmt(weekGoal)} words` : 'words'}</span>
                </div>
                {weekGoal ? (
                  <div
                    className="bar"
                    role="progressbar"
                    aria-label="Weekly goal"
                    aria-valuemin={0}
                    aria-valuemax={weekGoal}
                    aria-valuenow={Math.min(weekWords, weekGoal)}
                  >
                    <i style={{ width: `${Math.min(100, (weekWords / weekGoal) * 100)}%` }} />
                  </div>
                ) : null}
                <div className="mut">{dayLine}</div>
              </section>
            )}
          </div>
        </div>
      )}

      {confetti && <Confetti />}
      <Toast message={toast} />
    </div>
  )
}

function TodaySkeleton() {
  return (
    <div className="today-grid" aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 300 }} />
      <div className="stack">
        <div className="skeleton" style={{ height: 130 }} />
        <div className="skeleton" style={{ height: 130 }} />
      </div>
    </div>
  )
}
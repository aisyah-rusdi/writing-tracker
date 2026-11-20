// src/hooks/useTracker.js
// Loads entries and projects from the sheet and saves new entries.
//
// TEMPORARY: this is the simple version for the first usable build. E4 replaces it
// with the shared state (AppContext) plus the local cache and failed-save retry,
// so a failed save here only stays on screen, not across a reload.
//
// Each entry has a `status`: 'syncing' | 'saved' | 'failed'.

import { useCallback, useEffect, useRef, useState } from 'react'
import { addEntry, loadAll, newId } from '../lib/api'

const KEEP_RECENT_MS = 2 * 60 * 1000

export function useTracker() {
  const [entries, setEntries] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const entriesRef = useRef(entries)
  entriesRef.current = entries

  const setStatus = useCallback((id, status) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)))
  }, [])

  const refresh = useCallback(async () => {
    try {
      const data = await loadAll()
      setProjects(data.projects)
      setEntries((prev) => {
        const serverIds = new Set(data.entries.map((e) => e.id))
        // Keep entries made on this device that the sheet hasn't returned yet:
        // anything still syncing or failed, and anything saved in the last 2 minutes.
        const local = prev.filter(
          (e) =>
            !serverIds.has(e.id) &&
            (e.status !== 'saved' || Date.now() - (e.localAt || 0) < KEEP_RECENT_MS)
        )
        return [...data.entries.map((e) => ({ ...e, status: 'saved' })), ...local]
      })
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load when the page opens, and again whenever the tab comes back into view,
  // so a save made on the other device shows up.
  useEffect(() => {
    refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  const send = useCallback(
    async (entry) => {
      try {
        await addEntry({
          id: entry.id,
          date: entry.date,
          projectId: entry.projectId,
          words: entry.words,
          note: entry.note,
        })
        setStatus(entry.id, 'saved')
        setError(null)
      } catch (err) {
        setStatus(entry.id, 'failed')
        setError(err)
      }
    },
    [setStatus]
  )

  // The entry appears at once as 'syncing'. Its id is made here, so retrying
  // the same entry can never create a duplicate row in the sheet.
  const save = useCallback(
    ({ projectId, words, note, date }) => {
      const entry = {
        id: newId(),
        date,
        projectId,
        words,
        note: note || '',
        status: 'syncing',
        localAt: Date.now(),
      }
      setEntries((prev) => [...prev, entry])
      return send(entry)
    },
    [send]
  )

  const retry = useCallback(
    (id) => {
      const entry = entriesRef.current.find((e) => e.id === id)
      if (!entry) return Promise.resolve()
      setStatus(id, 'syncing')
      return send(entry)
    },
    [send, setStatus]
  )

  return { entries, projects, loading, error, refresh, save, retry }
}
// src/state/AppContext.jsx
// Shared entries and projects for every page (E4).
//
// - Opens instantly from the local cache, then refreshes from the sheet.
// - A new entry shows at once as 'syncing', then 'saved' or 'failed'.
// - Entries that fail (or are cut off by closing the page) are kept on this device
//   and sent again when the page opens, the tab returns, the connection comes back,
//   or the person taps "Not synced – tap to retry".
// - Retrying is always safe: the entry id is made on the device, and the sheet
//   answers "duplicate" for an id it already has.
// - update() and remove() (E9) change entries that the sheet already has. They
//   throw an ApiError on failure, so the page can show it, and only change the
//   local copy once the sheet has confirmed.
//
// Entry status: 'syncing' | 'saved' | 'failed'.

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addEntry, deleteEntry, loadAll, newId, updateEntry } from '../lib/api'
import { clearCache, loadCache, loadPending, saveCache, savePending } from '../lib/storage'

// eslint-disable-next-line react-refresh/only-export-components
export const AppContext = createContext(null)

// A just-saved entry is kept for 2 minutes even if a refresh that started earlier
// doesn't list it yet.
const KEEP_RECENT_MS = 2 * 60 * 1000

// The sheet itself refused these, so sending them again automatically would only
// fail again. Everything else (network, busy, wrong passphrase fixed in Settings,
// not connected yet) is worth another go.
const NO_AUTO_RETRY = ['BAD_REQUEST', 'NOT_FOUND']

function startState() {
  const cache = loadCache()
  const pending = loadPending()
  const pendingIds = new Set(pending.map((e) => e.id))
  const saved = cache.entries.filter((e) => !pendingIds.has(e.id)).map((e) => ({ ...e, status: 'saved' }))
  // Anything unsent when the page closed counts as failed until it is sent again.
  const unsent = pending.map((e) => ({ ...e, status: 'failed' }))
  return {
    entries: [...saved, ...unsent],
    projects: cache.projects,
    hadCache: cache.projects.length > 0 || cache.entries.length > 0,
  }
}

export function AppProvider({ children }) {
  const [start] = useState(startState)
  const [entries, setEntries] = useState(start.entries)
  const [projects, setProjects] = useState(start.projects)
  const [loading, setLoading] = useState(!start.hadCache) // true only with nothing to show yet
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [saveError, setSaveError] = useState(null)

  const entriesRef = useRef(entries)
  entriesRef.current = entries
  const sending = useRef(new Set()) // ids being sent right now, so none is sent twice
  const inflight = useRef(null) // the refresh in progress, if any
  const deleted = useRef(new Set()) // ids deleted here, so an older refresh can't bring them back

  const patch = useCallback((id, changes) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...changes } : e)))
  }, [])

  // Sends one entry. Never throws: the outcome lands in the entry's status.
  const send = useCallback(
    async (entry) => {
      if (sending.current.has(entry.id)) return
      sending.current.add(entry.id)
      patch(entry.id, { status: 'syncing' })
      try {
        await addEntry({
          id: entry.id,
          date: entry.date,
          projectId: entry.projectId,
          words: entry.words,
          note: entry.note,
        })
        patch(entry.id, { status: 'saved', localAt: Date.now() })
        setSaveError(null)
      } catch (err) {
        patch(entry.id, { status: 'failed', auto: !NO_AUTO_RETRY.includes(err && err.code) })
        setSaveError(err)
      } finally {
        sending.current.delete(entry.id)
      }
    },
    [patch]
  )

  const refresh = useCallback(() => {
    if (inflight.current) return inflight.current
    const run = async () => {
      setRefreshing(true)
      try {
        const data = await loadAll()
        const serverIds = new Set(data.entries.map((e) => e.id))
        const keep = (e) =>
          !serverIds.has(e.id) &&
          (e.status !== 'saved' || Date.now() - (e.localAt || 0) < KEEP_RECENT_MS)

        setProjects(data.projects)
        setEntries((prev) => [
          ...data.entries
            .filter((e) => !deleted.current.has(e.id))
            .map((e) => ({ ...e, status: 'saved' })),
          ...prev.filter(keep),
        ])
        setLoadError(null)
        // The sheet answered, so an old save problem is no longer news. If a
        // resend below fails again, it sets the error again. The entry's own
        // "Not synced" badge stays either way.
        setSaveError(null)

        // The sheet is reachable: send again what is still waiting.
        entriesRef.current
          .filter((e) => e.status === 'failed' && e.auto !== false && !serverIds.has(e.id))
          .forEach(send)
      } catch (err) {
        setLoadError(err)
      } finally {
        setLoading(false)
        setRefreshing(false)
        inflight.current = null
      }
    }
    inflight.current = run()
    return inflight.current
  }, [send])

  // Load when the page opens, when the tab comes back into view (so a save made on
  // the other device shows up), and when the connection returns.
  useEffect(() => {
    refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', refresh)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', refresh)
    }
  }, [refresh])

  // Keep the local copy up to date after every change.
  useEffect(() => {
    savePending(entries.filter((e) => e.status !== 'saved'))
    saveCache({ entries: entries.filter((e) => e.status === 'saved'), projects })
  }, [entries, projects])

  // The entry appears at once as 'syncing'. Its id is made here, so a retry of
  // the same entry can never create a second row in the sheet.
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

  // Manual retry (tapping the badge) always tries, whatever went wrong before.
  const retry = useCallback(
    (id) => {
      const entry = entriesRef.current.find((e) => e.id === id)
      return entry ? send(entry) : Promise.resolve()
    },
    [send]
  )

  // Changes an entry the sheet already has (E9).
  // changes: any of { date, projectId, words, note }. Throws an ApiError on failure.
  const update = useCallback(
    async (id, changes) => {
      await updateEntry(id, changes)
      patch(id, changes)
    },
    [patch]
  )

  // Deletes an entry the sheet already has (E9). Throws an ApiError on failure.
  const remove = useCallback(async (id) => {
    await deleteEntry(id) // { deleted: false } just means it was already gone
    deleted.current.add(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  // Called when the connection is removed: forget the cached sheet data.
  // Unsent entries stay on this device so no words are lost.
  const reset = useCallback(() => {
    clearCache()
    setProjects([])
    setEntries((prev) => prev.filter((e) => e.status !== 'saved'))
    setLoadError(null)
    setSaveError(null)
  }, [])

  const value = useMemo(
    () => ({
      entries,
      projects,
      loading,
      refreshing,
      error: loadError || saveError,
      loadError,
      unsyncedCount: entries.filter((e) => e.status !== 'saved').length,
      refresh,
      save,
      retry,
      update,
      remove,
      reset,
    }),
    [entries, projects, loading, refreshing, loadError, saveError, refresh, save, retry, update, remove, reset]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
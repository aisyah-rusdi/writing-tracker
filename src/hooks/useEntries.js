// src/hooks/useEntries.js
// Reads the shared state (see state/AppContext.jsx). Replaces useTracker.
//
//   const { entries, projects, loading, error, refresh, save, retry } = useEntries()
import { useContext } from 'react'
import { AppContext } from '../state/AppContext'

export function useEntries() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useEntries must be used inside <AppProvider>.')
  return ctx
}
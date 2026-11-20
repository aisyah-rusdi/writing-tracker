// src/hooks/useProjects.js
// The full project list (including archived ones) and the actions to change it.
// The list now lives in the shared state, so Today and Settings always agree.
import { useCallback } from 'react'
import { addProject, setProjectArchived, updateProject } from '../lib/api'
import { useEntries } from './useEntries'

export function useProjects() {
  const { projects, loading, loadError, refresh } = useEntries()

  // Each action throws an ApiError on failure (the page shows it), and reloads
  // on success so what is shown always matches the sheet.
  const add = useCallback(
    async (values) => {
      await addProject(values)
      await refresh()
    },
    [refresh]
  )
  const update = useCallback(
    async (id, changes) => {
      await updateProject(id, changes)
      await refresh()
    },
    [refresh]
  )
  const setArchived = useCallback(
    async (id, archived) => {
      await setProjectArchived(id, archived)
      await refresh()
    },
    [refresh]
  )

  return { projects, loading, error: loadError, refresh, add, update, setArchived }
}
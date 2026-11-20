// src/lib/api.js
// Talks to the Google Apps Script web app (the backend in apps-script/Code.gs).
//
// The Apps Script URL and the passphrase are NEVER written in the code.
// They are typed once per device in Settings and kept only in this browser's
// local storage.

const STORAGE_KEY = 'wt-connection'
const TIMEOUT_MS = 20000
const URL_PATTERN = /^https:\/\/script\.google\.com\/.+\/exec$/

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

// Codes: NOT_CONFIGURED, NETWORK, BAD_RESPONSE, STORAGE (made here)
//        BAD_PASSPHRASE, BAD_REQUEST, NOT_FOUND, BUSY, SERVER_ERROR (sent by the script)
export class ApiError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

// Plain-language title and message for an error, matching the storyboard banners.
export function describeError(err) {
  const code = err instanceof ApiError ? err.code : 'SERVER_ERROR'
  switch (code) {
    case 'NOT_CONFIGURED':
      return {
        title: 'Connect your sheet to sync',
        message: 'Add your Apps Script URL and passphrase in Settings.',
      }
    case 'NETWORK':
      return {
        title: 'Can’t reach your sheet',
        message: 'Check your connection, then try again.',
      }
    case 'BAD_PASSPHRASE':
      return {
        title: 'Wrong passphrase',
        message: 'The sheet didn’t accept it. Update the passphrase in Settings.',
      }
    case 'BAD_RESPONSE':
      return {
        title: 'Unexpected reply from your sheet',
        message:
          'Check that the Apps Script URL ends in /exec and that the web app is set to “Anyone”.',
      }
    case 'BUSY':
      return {
        title: 'The sheet is busy',
        message: 'Try again in a moment.',
      }
    case 'STORAGE':
      return {
        title: 'Can’t save on this device',
        message: 'Your browser blocked saving. Turn off private browsing and try again.',
      }
    default:
      return {
        title: 'Something went wrong',
        message: (err && err.message) || 'Try again.',
      }
  }
}

// Used later by the sync logic: should a failed save be retried?
export function isRetryable(err) {
  return (
    err instanceof ApiError &&
    (err.code === 'NETWORK' || err.code === 'BUSY' || err.code === 'SERVER_ERROR')
  )
}

/* ------------------------------------------------------------------ */
/* Connection settings (stored only in this browser)                   */
/* ------------------------------------------------------------------ */

export function getConnection() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return {
      url: (saved && saved.url) || '',
      passphrase: (saved && saved.passphrase) || '',
    }
  } catch {
    return { url: '', passphrase: '' }
  }
}

export function saveConnection({ url, passphrase }) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ url: url.trim(), passphrase: passphrase.trim() })
    )
  } catch {
    throw new ApiError('STORAGE', 'Could not save the connection on this device.')
  }
}

export function clearConnection() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // nothing to clear
  }
}

export function isConfigured() {
  const { url, passphrase } = getConnection()
  return Boolean(url && passphrase)
}

export function looksLikeScriptUrl(url) {
  return URL_PATTERN.test(url.trim())
}

/* ------------------------------------------------------------------ */
/* Low-level call                                                      */
/* ------------------------------------------------------------------ */

// Sends one request. Resolves with the script's `data`, or throws an ApiError.
// The body is sent as text/plain so the browser treats it as a "simple" request
// and skips the CORS preflight that Apps Script cannot answer.
async function call(action, payload = {}) {
  const { url, passphrase } = getConnection()
  if (!url || !passphrase) {
    throw new ApiError('NOT_CONFIGURED', 'Add your Apps Script URL and passphrase in Settings.')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, passphrase, action }),
      signal: controller.signal,
    })
  } catch {
    throw new ApiError('NETWORK', 'Could not reach the sheet.')
  } finally {
    clearTimeout(timer)
  }

  let json
  try {
    json = await response.json()
  } catch {
    throw new ApiError('BAD_RESPONSE', 'The sheet sent back something unexpected.')
  }

  if (!json || typeof json.ok !== 'boolean') {
    throw new ApiError('BAD_RESPONSE', 'The sheet sent back something unexpected.')
  }
  if (!json.ok) {
    const error = json.error || {}
    throw new ApiError(error.code || 'SERVER_ERROR', error.message || 'The script reported an error.')
  }
  return json.data
}

/* ------------------------------------------------------------------ */
/* Ids                                                                 */
/* ------------------------------------------------------------------ */

// A new unique id for an entry. Created on the device before saving, so a
// retry of the same save can never create a duplicate row.
export function newId() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID()
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

/* ------------------------------------------------------------------ */
/* General                                                             */
/* ------------------------------------------------------------------ */

// -> { time, timezone, today }
export const ping = () => call('ping')

// -> { entries, projects, today }
export const loadAll = () => call('loadAll')

/* ------------------------------------------------------------------ */
/* Entries                                                             */
/* ------------------------------------------------------------------ */

// range: { from: '2026-11-01', to: '2026-11-30' } (both optional) -> { entries }
export const listEntries = (range = {}) => call('listEntries', range)

// entry: { id, date, projectId, words, note } -> { entry, duplicate }
// Dates are 'yyyy-MM-dd'. Leave date out to use the sheet's today.
export const addEntry = (entry) => call('addEntry', entry)

// changes: any of { date, projectId, words, note } -> { entry }
export const updateEntry = (id, changes) => call('updateEntry', { id, ...changes })

// -> { deleted } (false means it was already gone)
export const deleteEntry = (id) => call('deleteEntry', { id })

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

// -> { projects }
export const listProjects = () => call('listProjects')

// project: { name, colour, dailyGoal, weeklyGoal } -> { project }
export const addProject = (project) => call('addProject', project)

// changes: any of { name, colour, sortOrder, dailyGoal, weeklyGoal } -> { project }
// Send dailyGoal or weeklyGoal as null to clear a goal.
export const updateProject = (id, changes) => call('updateProject', { id, ...changes })

// -> { project }
export const setProjectArchived = (id, archived) =>
  call('setProjectArchived', { id, archived })
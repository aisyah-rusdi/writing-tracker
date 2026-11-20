// src/lib/importExport.js
// One-time import of the old writing log, and CSV export (E11 part 2).
//
// CSV format (the same for import and export):
//   Date,Project,Words,Note
//   2026-08-26,Project: Brotherhood,127,
//   2026-08-26,Substack Essays,884,
//
// Import sends one request per entry. Each entry gets a fixed id built from its
// date and project, so running the same import twice can never create duplicates:
// the sheet answers "duplicate" for an id it already has and the entry is skipped.

import { addEntry, isRetryable, loadAll } from './api'

const MAX_WORDS = 1000000
const RETRIES = 2
const RETRY_DELAY_MS = 1500

/* ------------------------------------------------------------------ */
/* CSV reading                                                         */
/* ------------------------------------------------------------------ */

// Text -> array of rows (each an array of strings). Handles quoted fields,
// commas and line breaks inside quotes, "" for a quote, CRLF, and a BOM.
export function parseCsv(text) {
  const src = text.replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

function isRealDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return y >= 2000 && y <= 2100 && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/* ------------------------------------------------------------------ */
/* Import: check the file before anything is sent                      */
/* ------------------------------------------------------------------ */

// Reads the CSV text and matches projects by name (not by id).
// Nothing is sent to the sheet here. Returns:
//   entries:   [{ id, date, projectId, words, note }]  ready to send
//   problems:  [string]   if any, the import must not start
//   skipped:   number of rows with 0 or blank words (never stored)
//   totalWords, days, byProject: [{ id, name, colour, entries, words }]
export function buildPreview(text, projects) {
  const result = { entries: [], problems: [], skipped: 0, totalWords: 0, days: 0, byProject: [] }

  const rows = parseCsv(text)
  if (rows.length === 0) {
    result.problems.push('The file is empty.')
    return result
  }

  const header = rows[0].map((h) => h.trim().toLowerCase())
  const col = {
    date: header.indexOf('date'),
    project: header.indexOf('project'),
    words: header.indexOf('words'),
    note: header.indexOf('note'),
  }
  const missing = ['date', 'project', 'words'].filter((k) => col[k] < 0)
  if (missing.length) {
    result.problems.push(
      `Missing column: ${missing.join(', ')}. The first row must be Date, Project, Words, Note (separated by commas).`
    )
    return result
  }

  const byName = new Map(projects.map((p) => [p.name.trim().toLowerCase(), p]))
  const idCount = new Map()
  const perProject = new Map()
  const dates = new Set()

  rows.slice(1).forEach((r, i) => {
    const line = i + 2
    const get = (key) => (col[key] >= 0 ? (r[col[key]] ?? '').trim() : '')
    const date = get('date')
    const name = get('project')
    const wordsRaw = get('words').replace(/,/g, '')
    const note = get('note').slice(0, 500)

    // Zero or blank rows are not entries. The sheet rejects under 1 word,
    // and unlogged days are simply days with no entry.
    if (wordsRaw === '') {
      result.skipped++
      return
    }
    const words = Number(wordsRaw)
    if (!Number.isInteger(words) || words < 0 || words > MAX_WORDS) {
      result.problems.push(`Line ${line}: "${get('words')}" is not a whole number of words.`)
      return
    }
    if (words === 0) {
      result.skipped++
      return
    }

    if (!isRealDate(date)) {
      result.problems.push(`Line ${line}: "${date}" is not a date like 2026-08-26.`)
      return
    }

    const project = byName.get(name.toLowerCase())
    if (!project) {
      result.problems.push(`Line ${line}: no project called "${name}". Add it in Settings first.`)
      return
    }
    if (project.archived) {
      result.problems.push(`Line ${line}: "${project.name}" is archived. Restore it in Settings first.`)
      return
    }

    // Same date and project twice in one file gets -2, -3, ... in file order.
    const base = `import-${date}-${project.id}`
    const n = (idCount.get(base) || 0) + 1
    idCount.set(base, n)
    const id = n === 1 ? base : `${base}-${n}`

    result.entries.push({ id, date, projectId: project.id, words, note })
    result.totalWords += words
    dates.add(date)

    const tally = perProject.get(project.id) || {
      id: project.id,
      name: project.name,
      colour: project.colour,
      entries: 0,
      words: 0,
    }
    tally.entries++
    tally.words += words
    perProject.set(project.id, tally)
  })

  if (result.entries.length === 0 && result.problems.length === 0) {
    result.problems.push('No rows with words were found in the file.')
  }

  result.entries.sort((a, b) => a.date.localeCompare(b.date))
  result.days = dates.size
  result.byProject = [...perProject.values()]
  return result
}

/* ------------------------------------------------------------------ */
/* Import: send the entries                                            */
/* ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// A busy sheet or a dropped connection gets a couple of quick retries.
// Retrying is safe because the entry id is fixed.
async function sendWithRetry(entry) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await addEntry(entry)
    } catch (err) {
      if (attempt < RETRIES && isRetryable(err)) {
        await sleep(RETRY_DELAY_MS)
        continue
      }
      throw err
    }
  }
}

// Sends entries one at a time. Stops at the first failure.
// onProgress(done, total) is called after each entry.
// -> { added, existing, failedAt (index or null), error (or null) }
// To finish after a failure, just run it again: saved entries come back as "existing".
export async function importEntries(entries, onProgress = () => {}) {
  let added = 0
  let existing = 0
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    try {
      const res = await sendWithRetry({
        id: e.id,
        date: e.date,
        projectId: e.projectId,
        words: e.words,
        note: e.note,
      })
      if (res.duplicate) existing++
      else added++
    } catch (error) {
      return { added, existing, failedAt: i, error }
    }
    onProgress(i + 1, entries.length)
  }
  return { added, existing, failedAt: null, error: null }
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

function csvCell(value) {
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Entries + projects -> CSV text in the same format the import reads.
// Starts with a BOM so Excel opens it as UTF-8.
export function toCsv(entries, projects) {
  const byId = new Map(projects.map((p) => [p.id, p]))
  const order = (id) => (byId.get(id) ? byId.get(id).sortOrder : 0)
  const sorted = [...entries].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      order(a.projectId) - order(b.projectId) ||
      (a.loggedAt || '').localeCompare(b.loggedAt || '')
  )
  const lines = [['Date', 'Project', 'Words', 'Note']]
  for (const e of sorted) {
    const project = byId.get(e.projectId)
    lines.push([e.date, project ? project.name : e.projectId, e.words, e.note || ''])
  }
  return '\uFEFF' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

function downloadFile(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Loads everything from the sheet and downloads it as a CSV.
// -> number of entries exported (nothing is downloaded when it is 0)
export async function exportCsv() {
  const data = await loadAll()
  if (data.entries.length === 0) return 0
  downloadFile(`writing-log-${data.today}.csv`, toCsv(data.entries, data.projects))
  return data.entries.length
}
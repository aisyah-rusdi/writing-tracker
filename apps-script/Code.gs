/**
 * Arora's Writing Tracker - backend (Google Apps Script)
 *
 * Lives inside the Google Sheet (Extensions > Apps Script).
 * The website talks to it with POST requests. Every request must include
 * the passphrase stored in Script Properties (key: PASSPHRASE).
 *
 * Request body (JSON, sent as text/plain so browsers don't block it):
 *   { "passphrase": "...", "action": "addEntry", ...fields }
 *
 * Response (always JSON):
 *   { "ok": true,  "data": { ... } }
 *   { "ok": false, "error": { "code": "...", "message": "..." } }
 *
 * Error codes: BAD_PASSPHRASE, BAD_REQUEST, NOT_FOUND, BUSY, SERVER_ERROR
 */

const SHEET_ENTRIES = 'Entries';
const SHEET_PROJECTS = 'Projects';
const SHEET_SUMMARY = 'Summary';
const ENTRY_COLS = 6;   // ID, Date, Logged at, Project ID, Words, Note
const PROJECT_COLS = 7; // Project ID, Name, Colour, Archived, Sort order, Daily goal, Weekly goal

class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/* ------------------------------------------------------------------ */
/* Entry points                                                        */
/* ------------------------------------------------------------------ */

function doGet() {
  return json_({ ok: false, error: { code: 'BAD_REQUEST', message: 'Use POST.' } });
}

function doPost(e) {
  try {
    const req = parseRequest_(e);
    checkPassphrase_(req.passphrase);
    const handler = ACTIONS[req.action];
    if (!handler) throw new ApiError('BAD_REQUEST', 'Unknown action.');
    const data = handler.write ? withLock_(() => handler.run(req)) : handler.run(req);
    return json_({ ok: true, data: data });
  } catch (err) {
    if (err instanceof ApiError) {
      return json_({ ok: false, error: { code: err.code, message: err.message } });
    }
    console.error(err);
    return json_({ ok: false, error: { code: 'SERVER_ERROR', message: 'Something went wrong in the script.' } });
  }
}

const ACTIONS = {
  ping:              { run: ping_ },
  loadAll:           { run: loadAll_ },
  listEntries:       { run: listEntries_ },
  addEntry:          { write: true, run: addEntry_ },
  updateEntry:       { write: true, run: updateEntry_ },
  deleteEntry:       { write: true, run: deleteEntry_ },
  listProjects:      { run: listProjects_ },
  addProject:        { write: true, run: addProject_ },
  updateProject:     { write: true, run: updateProject_ },
  setProjectArchived:{ write: true, run: setProjectArchived_ },
};

/* ------------------------------------------------------------------ */
/* Request helpers                                                     */
/* ------------------------------------------------------------------ */

function parseRequest_(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (x) {
    throw new ApiError('BAD_REQUEST', 'Request body must be JSON.');
  }
  if (!req || typeof req !== 'object') throw new ApiError('BAD_REQUEST', 'Request body must be JSON.');
  return req;
}

function checkPassphrase_(given) {
  const expected = PropertiesService.getScriptProperties().getProperty('PASSPHRASE');
  if (!expected) throw new ApiError('SERVER_ERROR', 'PASSPHRASE is not set in Script Properties.');
  if (typeof given !== 'string' || !safeEqual_(given, expected)) {
    Utilities.sleep(1000); // slows down guessing
    throw new ApiError('BAD_PASSPHRASE', 'Wrong passphrase.');
  }
}

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (x) {
    throw new ApiError('BUSY', 'The sheet is busy. Try again.');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/* General actions                                                     */
/* ------------------------------------------------------------------ */

function ping_() {
  return { time: new Date().toISOString(), timezone: Session.getScriptTimeZone(), today: todayString_() };
}

function loadAll_() {
  return { entries: readEntries_(), projects: readProjects_(), today: todayString_() };
}

/* ------------------------------------------------------------------ */
/* Entries                                                             */
/* ------------------------------------------------------------------ */

function listEntries_(req) {
  const from = req.from ? validateDate_(req.from) : null;
  const to = req.to ? validateDate_(req.to) : null;
  const entries = readEntries_().filter(function (e) {
    return (!from || e.date >= from) && (!to || e.date <= to);
  });
  return { entries: entries };
}

function addEntry_(req) {
  const id = req.id ? validateId_(req.id) : Utilities.getUuid();
  const sh = sheet_(SHEET_ENTRIES);

  // Retrying the same ID never creates a duplicate.
  const existing = findRow_(sh, id);
  if (existing) {
    return { entry: rowToEntry_(sh.getRange(existing, 1, 1, ENTRY_COLS).getValues()[0]), duplicate: true };
  }

  const entry = {
    id: id,
    date: req.date ? validateDate_(req.date) : todayString_(),
    loggedAt: new Date().toISOString(),
    projectId: validateActiveProject_(req.projectId),
    words: validateWords_(req.words),
    note: cleanText_(req.note, 500),
  };

  const row = sh.getLastRow() + 1;
  writeEntryRow_(sh, row, entry);
  rebuildSummary_();
  return { entry: entry, duplicate: false };
}

function updateEntry_(req) {
  const id = validateId_(req.id);
  const sh = sheet_(SHEET_ENTRIES);
  const row = findRow_(sh, id);
  if (!row) throw new ApiError('NOT_FOUND', 'Entry not found.');

  const entry = rowToEntry_(sh.getRange(row, 1, 1, ENTRY_COLS).getValues()[0]);
  if (req.date !== undefined) entry.date = validateDate_(req.date);
  if (req.words !== undefined) entry.words = validateWords_(req.words);
  if (req.note !== undefined) entry.note = cleanText_(req.note, 500);
  if (req.projectId !== undefined && req.projectId !== entry.projectId) {
    entry.projectId = validateActiveProject_(req.projectId);
  }

  writeEntryRow_(sh, row, entry);
  rebuildSummary_();
  return { entry: entry };
}

function deleteEntry_(req) {
  const id = validateId_(req.id);
  const sh = sheet_(SHEET_ENTRIES);
  const row = findRow_(sh, id);
  if (!row) return { deleted: false }; // already gone, so a retry is harmless
  sh.deleteRow(row);
  rebuildSummary_();
  return { deleted: true };
}

function readEntries_() {
  const sh = sheet_(SHEET_ENTRIES);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, ENTRY_COLS).getValues()
    .filter(function (r) { return r[0] !== ''; })
    .map(rowToEntry_);
}

function rowToEntry_(r) {
  return {
    id: String(r[0]),
    date: dateToString_(r[1]),
    loggedAt: r[2] instanceof Date ? r[2].toISOString() : String(r[2]),
    projectId: String(r[3]),
    words: Number(r[4]) || 0,
    note: String(r[5] === undefined || r[5] === null ? '' : r[5]),
  };
}

function writeEntryRow_(sh, row, entry) {
  // Text format on ID, date, logged-at and project ID so Sheets never reinterprets them.
  sh.getRange(row, 1, 1, 4).setNumberFormat('@');
  sh.getRange(row, 1, 1, ENTRY_COLS).setValues([[
    entry.id, entry.date, entry.loggedAt, entry.projectId, entry.words, entry.note,
  ]]);
}

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

function listProjects_() {
  return { projects: readProjects_() };
}

function addProject_(req) {
  const sh = sheet_(SHEET_PROJECTS);
  const projects = readProjects_();
  const name = validateName_(req.name, projects, null);
  const project = {
    id: makeProjectId_(name, projects),
    name: name,
    colour: req.colour ? validateColour_(req.colour) : '#3F6B4E',
    archived: false,
    sortOrder: projects.reduce(function (m, p) { return Math.max(m, p.sortOrder); }, 0) + 1,
    dailyGoal: validateGoal_(req.dailyGoal),
    weeklyGoal: validateGoal_(req.weeklyGoal),
  };
  writeProjectRow_(sh, sh.getLastRow() + 1, project);
  return { project: project };
}

function updateProject_(req) {
  const id = validateId_(req.id);
  const sh = sheet_(SHEET_PROJECTS);
  const row = findRow_(sh, id);
  if (!row) throw new ApiError('NOT_FOUND', 'Project not found.');

  const project = projectFromRow_(sh.getRange(row, 1, 1, PROJECT_COLS).getValues()[0]);
  if (req.name !== undefined) project.name = validateName_(req.name, readProjects_(), id);
  if (req.colour !== undefined) project.colour = validateColour_(req.colour);
  if (req.sortOrder !== undefined) project.sortOrder = validateSortOrder_(req.sortOrder);
  if (req.dailyGoal !== undefined) project.dailyGoal = validateGoal_(req.dailyGoal);   // null clears the goal
  if (req.weeklyGoal !== undefined) project.weeklyGoal = validateGoal_(req.weeklyGoal); // null clears the goal

  writeProjectRow_(sh, row, project);
  return { project: project };
}

function setProjectArchived_(req) {
  const id = validateId_(req.id);
  if (typeof req.archived !== 'boolean') throw new ApiError('BAD_REQUEST', 'archived must be true or false.');
  const sh = sheet_(SHEET_PROJECTS);
  const row = findRow_(sh, id);
  if (!row) throw new ApiError('NOT_FOUND', 'Project not found.');

  const project = projectFromRow_(sh.getRange(row, 1, 1, PROJECT_COLS).getValues()[0]);
  project.archived = req.archived;
  writeProjectRow_(sh, row, project);
  return { project: project };
}

function readProjects_() {
  const sh = sheet_(SHEET_PROJECTS);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, PROJECT_COLS).getValues()
    .filter(function (r) { return r[0] !== ''; })
    .map(projectFromRow_)
    .sort(function (a, b) { return a.sortOrder - b.sortOrder; });
}

function projectFromRow_(r) {
  return {
    id: String(r[0]),
    name: String(r[1]),
    colour: String(r[2]),
    archived: String(r[3]).toLowerCase() === 'yes',
    sortOrder: Number(r[4]) || 0,
    dailyGoal: goalFromCell_(r[5]),
    weeklyGoal: goalFromCell_(r[6]),
  };
}

function writeProjectRow_(sh, row, p) {
  sh.getRange(row, 1, 1, 3).setNumberFormat('@');
  sh.getRange(row, 1, 1, PROJECT_COLS).setValues([[
    p.id, p.name, p.colour, p.archived ? 'Yes' : 'No', p.sortOrder,
    p.dailyGoal === null ? '' : p.dailyGoal,
    p.weeklyGoal === null ? '' : p.weeklyGoal,
  ]]);
}

function goalFromCell_(v) {
  return v === '' || v === null || v === undefined ? null : Number(v);
}

function makeProjectId_(name, projects) {
  let base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  if (!base) base = 'project';
  const taken = {};
  projects.forEach(function (p) { taken[p.id] = true; });
  let id = base;
  let n = 2;
  while (taken[id]) id = base + '-' + n++;
  return id;
}

/* ------------------------------------------------------------------ */
/* Summary sheet (weekly totals, Monday to Sunday)                     */
/* ------------------------------------------------------------------ */

function rebuildSummary_() {
  const totals = {};
  readEntries_().forEach(function (e) {
    const ws = weekStart_(e.date);
    totals[ws] = (totals[ws] || 0) + e.words;
  });
  const weeks = Object.keys(totals).sort();

  const sh = sheet_(SHEET_SUMMARY);
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 3).clearContent();
  if (!weeks.length) return;

  const rows = weeks.map(function (w) { return [w, addDays_(w, 6), totals[w]]; });
  sh.getRange(2, 1, rows.length, 2).setNumberFormat('@');
  sh.getRange(2, 1, rows.length, 3).setValues(rows);
}

function weekStart_(dateStr) {
  const p = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

function addDays_(dateStr, n) {
  const p = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Sheet and date helpers                                              */
/* ------------------------------------------------------------------ */

function sheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new ApiError('SERVER_ERROR', 'Sheet tab "' + name + '" is missing.');
  return sh;
}

function findRow_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) return i + 2;
  }
  return 0;
}

function todayString_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function dateToString_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function validateId_(v) {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(v)) {
    throw new ApiError('BAD_REQUEST', 'Invalid ID.');
  }
  return v;
}

function validateDate_(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new ApiError('BAD_REQUEST', 'Date must look like 2026-11-20.');
  }
  const p = v.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  if (p[0] < 2000 || p[0] > 2100 || d.getUTCMonth() !== p[1] - 1 || d.getUTCDate() !== p[2]) {
    throw new ApiError('BAD_REQUEST', 'That date does not exist.');
  }
  return v;
}

function validateWords_(v) {
  const n = Number(v);
  if (v === '' || v === null || v === undefined || !Number.isInteger(n) || n < 1 || n > 1000000) {
    throw new ApiError('BAD_REQUEST', 'Words must be a whole number from 1 to 1,000,000.');
  }
  return n;
}

function validateActiveProject_(projectId) {
  const id = validateId_(projectId);
  const project = readProjects_().filter(function (p) { return p.id === id; })[0];
  if (!project) throw new ApiError('BAD_REQUEST', 'Unknown project.');
  if (project.archived) throw new ApiError('BAD_REQUEST', 'That project is archived.');
  return id;
}

function validateName_(v, projects, ownId) {
  const name = cleanText_(v, 60);
  if (!name) throw new ApiError('BAD_REQUEST', 'Project name cannot be empty.');
  const clash = projects.some(function (p) {
    return p.id !== ownId && p.name.toLowerCase() === name.toLowerCase();
  });
  if (clash) throw new ApiError('BAD_REQUEST', 'A project with that name already exists.');
  return name;
}

function validateColour_(v) {
  if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) {
    throw new ApiError('BAD_REQUEST', 'Colour must look like #3F6B4E.');
  }
  return v.toUpperCase();
}

function validateGoal_(v) {
  if (v === undefined || v === null || v === '') return null; // no goal
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 1000000) {
    throw new ApiError('BAD_REQUEST', 'A goal must be a whole number, or empty for no goal.');
  }
  return n;
}

function validateSortOrder_(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 10000) throw new ApiError('BAD_REQUEST', 'Invalid sort order.');
  return n;
}

// Trims, limits length, and stops text starting with = + - @ from being read as a formula.
function cleanText_(v, max) {
  if (typeof v !== 'string') return '';
  let s = v.trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

/* ------------------------------------------------------------------ */
/* Manual check: run this once from the editor                         */
/* ------------------------------------------------------------------ */

function testSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lines = [];
  [SHEET_ENTRIES, SHEET_PROJECTS, SHEET_SUMMARY].forEach(function (n) {
    lines.push(n + ' tab: ' + (ss.getSheetByName(n) ? 'found' : 'MISSING'));
  });
  lines.push('PASSPHRASE: ' + (PropertiesService.getScriptProperties().getProperty('PASSPHRASE') ? 'set' : 'NOT SET'));
  lines.push('Time zone: ' + Session.getScriptTimeZone());
  lines.push('Projects found: ' + readProjects_().length);
  lines.push('Entries found: ' + readEntries_().length);
  Logger.log(lines.join('\n'));
}
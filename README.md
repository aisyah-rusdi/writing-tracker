# Arora's Writing Tracker

A personal website to track daily writing output (in **words**) for a writing challenge, replacing a manual spreadsheet.

**Core idea:** the app owns the calendar. Dates, weeks and totals are automatic, and the only things typed by hand are the word count and the project.

---

## 1. Overview

### Goals

- Log a day's words in a few seconds: open, type a number, pick a project, save.
- Never type dates or create weeks manually.
- Support any number of projects, each with its own name and colour.
- Work from both phone and laptop with the same data.
- Keep a real Google Sheet as the database, owned and editable by the writer.
- Show totals, trends and gaps automatically, overall and per project.
- Light and dark mode.

---

## 2. Tech stack and key decisions

| Tech stack | Key decisions |
| --- | --- |
| Hosting | GitHub Pages (static site) |
| Frontend | Vite + React, plain JavaScript (JSX) |
| Styling | Plain CSS, light and dark themes via colour variables |
| Routing | Hash-based routing (works on GitHub Pages without a server) |
| Charts / dates | Plain CSS charts, date-fns |
| Database | Google Sheet, accessed through Google Apps Script (no Google Cloud project or OAuth) |
| Deployment | GitHub Actions builds and publishes on every push |
| Devices | Phone and laptop, same link, synced through the sheet |
| Week start | Monday to Sunday (configurable in Settings) |
| Unit label | "words" |
| Entries | One row per entry, not one total per day |
| Projects | A managed list with ID, name, colour, goals and an archived flag. Entries store the project ID. |
| Fonts | Fraunces (headings) and DM Sans (text and numbers) |

### Security notes

- The repo is public, so **no secrets go in the code**.
- The Apps Script URL and passphrase are typed once per device in Settings and stored only in that browser. On the backend, the passphrase lives in the script's Script Properties, not in `Code.gs`.
- The Apps Script URL is public, so the script must check the passphrase before accepting any read or write.
- Use a long, random passphrase and keep the site link unshared. The site is public but the data is private.
- Free GitHub accounts can't serve Pages from a private repo.
- `index.html` carries a "don't index this site" tag.

---

## 3. Architecture

```
Browser (React site on GitHub Pages)
        |
        |  HTTPS requests (with passphrase)
        v
Google Apps Script web app
        |
        v
Google Sheet
   - Entries   (one row per entry)
   - Projects  (project list)
   - Summary   (simple weekly totals)
```

### Save flow

1. You type the word count, picks a project and taps Save.
2. The entry appears immediately, marked "Syncing". Its ID is made on the device.
3. The app sends it to the Apps Script in the background.
4. The mark changes to "Saved" once confirmed.
5. If the connection fails, the entry stays on screen and on the device marked "Not synced". It is sent again when the page opens, the tab returns, the connection comes back, or when you tap it. Retrying is always safe: the sheet answers "duplicate" for an ID it already has.

### Load flow

1. Show the locally cached entries and projects instantly.
2. Refresh from the sheet in the background (also when the tab comes back into view, so a save made on the other device shows up).
3. Update every page from one shared state.

### Edit and delete

History can edit or delete entries the sheet already has. The local copy only changes once the sheet confirms. Entries still syncing or failed can't be edited or deleted until they are saved.

---

## 4. Google Sheet design

### Entries sheet (one row per entry)

| Column | Description |
| --- | --- |
| ID | Unique entry ID, so edits and retries never create duplicates |
| Date | The day the writing belongs to (set automatically) |
| Logged at | Timestamp of when the entry was saved |
| Project ID | Links to the Projects sheet |
| Words | Number written |
| Note | Optional, e.g. "restructuring plot" |

### Projects sheet

| Column | Description |
| --- | --- |
| Project ID | Unique and permanent |
| Name | Editable |
| Colour | Any colour chosen with the colour picker in Settings. Used in charts and the picker |
| Archived | Yes/No. Archived projects are hidden from the picker but still appear in history and stats |
| Sort order | Order shown in the picker |
| Daily goal | Words per day goal for this project. Blank means no goal |
| Weekly goal | Words per week goal for this project. Blank means no goal |

### Summary sheet

- Because projects keep growing, fixed per-project columns won't work.
- The Summary sheet holds a simple weekly total (week, dates, total words).
- The per-project weekly breakdown is calculated by the app itself.

### Apps Script responsibilities

- Check the passphrase on every request.
- Endpoints to add, list, edit and delete entries, and to add, list, update and archive projects.
- Return data in one consistent format.
- Accept requests in a way that stops the browser blocking them (the app sends the body as `text/plain` to avoid a CORS preflight).

---

## 5. Pages

| Page | Purpose |
| --- | --- |
| **Today** | Date pre-filled, large word-count box, project picker, optional note, today's running total and entries with sync status, this week's progress, a small celebration when a goal is reached |
| **Week** | Previous/next week, day-by-day stacked bar chart coloured by project, week total, days written, per-project cards, optional project filter |
| **History** | Calendar (with month navigation) or list of all days, tap a day to add, edit or delete, unlogged days marked |
| **Stats** | Summary cards, weekly totals table (project mix bar per week, tap a week for its breakdown), Recent weeks bars, gap list, goals with progress, filter by project or combined |
| **Settings** | Apps Script URL, passphrase, project list (add, edit, pick any colour, archive, restore), daily and weekly goals per project, week start day, theme, import/export, connection status |

### Project picker

- Opens with the first project preselected, then remembers the last project used.
- Shown as a row of chips (up to 4 projects) or a dropdown (more than 4).
- Each option shows its colour.

### Stats

- **Grand total, average per writing day, best day, current streak**, overall or per project.
- **Average per writing day** is total words divided by the number of days with any words.
- **Best day** is the day with the most words across all projects.
- **Current streak** counts consecutive written days ending today. If today has nothing yet, it counts back from yesterday, so it only breaks after a whole empty day.
- **Weekly totals** group Monday to Sunday (or the chosen start day). The newest 4 weeks get their own row; older weeks fold into "Earlier weeks", with a button to show every week.
- **Gaps** are runs of 3 or more days with no words between two written days. The stretch since the last entry is not a gap, because today is still in progress.
- **Goal progress** shows daily and weekly goals per project with today's and this week's words.

### Goal celebration

- **When it fires:** a save on Today takes a project's total for the day, or for the week, to or past its goal. Each goal celebrates once per day or week, not on every later save.
- **What it looks like:** a short confetti burst in the theme colours and a one-line quote with its author, gone after a few seconds.
- **Where it shows:** on mobile, an inline pink card at the top of Today plus confetti. On desktop, a toast with the quote plus confetti.
- **Only where a goal exists:** a project with no goal never celebrates.
- **Never on import** or when adding or editing entries from History.
- **Respects the device:** with reduced motion switched on, only the message shows. A Settings switch turns it off.

### Celebration messages

The messages are one-line quotes from writers about writing, credited to the author and picked at random. They live in their own file, `src/data/celebrationMessages.json`, as a list of `text` and `author` pairs. To add, remove or reword a quote, edit that file only; the code never needs changing.

---

## 6. Design

### Layout and type

- Rounded cards, generous whitespace, tabular figures for numbers.
- Fraunces for headings and the brand, DM Sans for text and numbers.

### Light theme ("strawberry matcha")

- Pink base: #FCEEF1
- Card surface: #FFF9FA
- Text: #2A2427
- Muted text: #7C6B72
- Lines: #F1D7DE
- Green accent: #3F6B4E (soft #D8E8DB)
- Pink highlight: #E9A7B9 (soft #F7D3DE)
- Beige appears only as a minor touch (confetti).

### Dark theme ("blueberry cheesecake")

- Indigo base: #1A1636
- Card surface: #262050
- Cream text: #F7F0E1
- Muted text: #B8B0D4
- Lines: #3B3470
- Periwinkle accent: #9AA6FF (soft #2F3A78)
- Lavender highlight: #D6A6EC (soft #3E2C6E)
- Butter-yellow buttons: #F4E4A6
- Error: #FF9AA2
- Project dots, stacked bars and mix bars get a light outline #EDE3CF so a black project stays visible.

### States designed

- Goal reached (inline card on mobile, toast on desktop, plus confetti).
- First time: a "Connect your sheet to sync" banner and a "Nothing logged yet" empty state.
- Loading: shimmer skeletons (static with reduced motion).
- Errors: "Can't reach your sheet" (with Try again), "Wrong passphrase" (with Open Settings), and the "Not synced, tap to retry" badge. Week, Stats and History show the same banner instead of a false "nothing logged" message when the sheet can't be loaded.
- A page that crashes shows a plain message with a Reload button instead of a blank screen.
- Archived projects, with a "(archived)" label in history.

### Hardening

- **Midnight rollover:** "today" and the current week update by themselves if the page stays open past midnight, and when the tab comes back into view.
- **Duplicates:** entry IDs are made on the device and the sheet rejects an ID it already has, so retries, reloads mid-save and re-importing a file never double up.

---

## 7. Importing and exporting

**Import** (Settings, Data): choose a CSV file with the columns `Date, Project, Words, Note`.

```
Date,Project,Words,Note
```

- Each row becomes its own daily entry (not weekly totals), so streaks, gaps, best day and average per writing day work correctly.
- Projects are matched by name. They must already exist and not be archived.
- Rows with 0 or blank words are skipped. They stay as unlogged days.
- The file is checked first and a preview is shown; nothing is sent if there are problems.
- Each entry gets a fixed ID built from its date and project, so importing the same file twice never creates duplicates, and an interrupted import can be run again to finish.

**Export** downloads every entry as a CSV in the same format. Excel opens it directly.

---

## 8. Getting started

1. Install and run locally:
   ```
   npm install
   npm run dev
   ```
2. Create a Google Sheet and add the script from `apps-script/Code.gs` through Extensions, Apps Script. Set the passphrase in the script's Script Properties and deploy it as a web app that anyone with the link can reach.
3. Open the site, go to Settings, and enter the Apps Script URL (it ends in `/exec`) and the passphrase. Do this once on each device.
4. To publish, push to GitHub. The workflow in `.github/workflows/deploy.yml` builds and publishes to GitHub Pages. The `base` path in `vite.config.js` must match the repo name (`writing-tracker`), or the page loads blank.

---

## 9. Code modules

| Module | Responsibility |
| --- | --- |
| `lib/api` | Talks to the Apps Script URL (entries and projects; error handling) |
| `lib/dates` | Today's date, week boundaries, week navigation, formatting, filling unlogged days |
| `lib/stats` | Totals, averages, best day, streaks, weekly totals, gaps, goal progress, filterable by project |
| `lib/storage` | Local cache and failed-save retry |
| `lib/importExport` | CSV import (preview, then send) and CSV export |
| `lib/celebration` | When a goal celebration fires, and which quote |
| `lib/prefs` | Small per-device preferences (last project, celebration switch, week start, theme) |
| `lib/theme` | Applies System, Light or Dark, and tells the header toggle |
| `data/celebrationMessages.json` | The celebration quotes (text and author) |
| `state/AppContext` | Shared entries and projects, so all pages update instantly |
| `hooks` | `useEntries`, `useProjects`, `useSettings`, `useTheme`, `useToday`, `useWeek` |
| `components` | Word input, project picker, entry row, day cell, day sheet, modal, week chart, weekly table, stat card, nav bar, toast, confetti, settings cards, load banner, error boundary |
| `pages` | Today, Week, History, Stats, Settings |

---

## 10. Epics

| # | Epic | Scope | Status |
| --- | --- | --- | --- |
| E1 | Project setup and deployment | Vite + React (JSX), plain CSS, hash routing, GitHub Actions publishing to GitHub Pages | ✅ |
| E2 | Google Sheet and Apps Script | Entries and Projects sheets, add/list/edit endpoints, passphrase check, Summary totals | ✅ |
| E3 | API module | Send/fetch entries and projects, error and wrong-passphrase handling | ✅ |
| E4 | Store and sync | Shared state, local cache, retry for failed saves, synced/not-synced markers, refresh on open | ✅ |
| E5 | Dates and weeks | Today auto-detected, Monday week start (configurable), week navigation, unlogged days filled in | ✅ |
| E6 | Stats engine | Weekly and per-project totals, average per writing day, best day, streak, gaps, goal progress | ✅ |
| E7 | Today page | Word-count box, project picker, note, running totals, goal celebration | ✅ |
| E8 | Week page | Stacked day-by-day chart, week total, previous/next, project filter | ✅ |
| E9 | History page | Calendar and list, tap a day to add, edit or delete | ✅ |
| E10 | Stats page | Weekly table with mix bars and tap-to-expand breakdown, summary cards, Recent weeks bars, gap list, goals, project filter | ✅ |
| E11 | Settings and data tools | Script URL, passphrase, project management, week start, goals, import, CSV export | ✅ |
| E12 | UI, styling and theming | Design tokens, user-chosen project colours, mobile-first layout, nav bar and bottom tabs, light/dark mode with toggle, dark-mode outlines | ✅ |
| E13 | Quality and hardening | Midnight rollover, load-error states, error boundary, duplicates, archived projects in old data, cross-device sync testing | ✅ code, testing still open |

---

## 11. Folder structure

Alphabetical within each folder. Epic labels show where each file came from.

```
writing-tracker/
├── .github/
│   └── workflows/
│       └── deploy.yml                  E1   
├── .gitignore                           
├── apps-script/
│   └── Code.gs                         E2  
├── eslint.config.js                   
├── index.html                          
├── package-lock.json
├── package.json
├── public/
│   └── favicon.svg
├── README.md
├── src/
│   ├── App.jsx                         E1/E12  
│   ├── components/
│   │   ├── Confetti.jsx                E7   
│   │   ├── ConnectionCard.jsx          E11  
│   │   ├── DataCard.jsx                E11  
│   │   ├── DayCell.jsx                 E9   
│   │   ├── DaySheet.jsx                E9   
│   │   ├── EntryRow.jsx                E7   
│   │   ├── ErrorBoundary.jsx           E13  
│   │   ├── LoadGate.jsx                E13  
│   │   ├── Modal.jsx                   E9   
│   │   ├── NavBar.jsx                  E12  
│   │   ├── PreferencesCard.jsx         E11  
│   │   ├── ProjectForm.jsx             E11  
│   │   ├── ProjectPicker.jsx           E7   
│   │   ├── ProjectsCard.jsx            E11  
│   │   ├── StatCard.jsx                E8/E10  
│   │   ├── Toast.jsx                   E7
│   │   ├── WeekChart.jsx               E8   
│   │   ├── WeeklyTable.jsx             E10  
│   │   └── WordInput.jsx               E7
│   ├── data/
│   │   └── celebrationMessages.json    E7   
│   ├── hooks/
│   │   ├── useEntries.js               E4   
│   │   ├── useProjects.js              E11
│   │   ├── useSettings.js              E11  
│   │   ├── useTheme.js                 E12  
│   │   ├── useToday.js                 E13  
│   │   └── useWeek.js                  E5   
│   ├── lib/
│   │   ├── api.js                      E3   
│   │   ├── celebration.js              E7     
│   │   ├── dates.js                    E5     
│   │   ├── importExport.js             E11  
│   │   ├── prefs.js                    E7   
│   │   ├── stats.js                    E6    
│   │   ├── storage.js                  E4   
│   │   └── theme.js                    E11/E12 
│   ├── main.jsx                        E1   
│   ├── pages/
│   │   ├── History.jsx                 E9
│   │   ├── Settings.jsx                E11
│   │   ├── Stats.jsx                   E10
│   │   ├── Today.jsx                   E7
│   │   └── Week.jsx                    E8
│   ├── state/
│   │   └── AppContext.jsx              E4   
│   └── styles/
│       ├── base.css                    
│       ├── components.css              
│       └── tokens.css                  
└── vite.config.js                      
```

### Notes

- **Celebration quotes are data, not code.** Changing a message means editing `celebrationMessages.json` only.
- **The script URL and passphrase are not in any file.** They are typed into Settings and stored only in that browser.
- **`apps-script/` is only a copy for records.** Apps Script runs inside Google, so the code is pasted there. The copy lets the backend be rebuilt if needed.
- **`.gitignore` must exclude the old log** (the original spreadsheet and any CSV exports), because the repo is public and those files contain real numbers.
- **`vite.config.js` base path:** GitHub Pages serves the site at `yourname.github.io/repo-name/`, so the config needs the repo name or the page loads blank.
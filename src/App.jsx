import { useState, useEffect } from 'react'
import Today from './pages/Today.jsx'
import Week from './pages/Week.jsx'
import History from './pages/History.jsx'
import Stats from './pages/Stats.jsx'
import Settings from './pages/Settings.jsx'

const TABS = [
  { path: 'today', label: 'Today', Page: Today },
  { path: 'week', label: 'Week', Page: Week },
  { path: 'history', label: 'History', Page: History },
  { path: 'stats', label: 'Stats', Page: Stats },
  { path: 'settings', label: 'Settings', Page: Settings },
]

function currentPath() {
  const p = window.location.hash.replace(/^#\/?/, '')
  return TABS.some((t) => t.path === p) ? p : 'today'
}

export default function App() {
  const [path, setPath] = useState(currentPath())

  useEffect(() => {
    const onChange = () => setPath(currentPath())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const { Page } = TABS.find((t) => t.path === path)

  return (
    <div>
      <header>
        <strong>Arora’s Writing Tracker</strong>
        <nav>
          {TABS.map((t) => (
            <a
              key={t.path}
              href={`#/${t.path}`}
              style={{ marginRight: 12, fontWeight: t.path === path ? 700 : 400 }}
            >
              {t.label}
            </a>
          ))}
        </nav>
      </header>
      <main>
        <Page />
      </main>
    </div>
  )
}
import { useEffect, useState } from 'react'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import NavBar from './components/NavBar.jsx'
import { useTheme } from './hooks/useTheme.js'
import Today from './pages/Today.jsx'
import Week from './pages/Week.jsx'
import History from './pages/History.jsx'
import Stats from './pages/Stats.jsx'
import Settings from './pages/Settings.jsx'

const BRAND = 'Arora’s Writing Tracker'

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
  const { dark, toggle } = useTheme()

  useEffect(() => {
    const onChange = () => setPath(currentPath())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const { Page, label } = TABS.find((t) => t.path === path)

  // A new page starts at the top, and the tab title says where you are.
  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = `${label} · ${BRAND}`
  }, [path, label])

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">{BRAND}</div>
        <NavBar tabs={TABS} current={path} variant="top" />
        <button
          type="button"
          className="theme-toggle"
          aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}
          onClick={toggle}
        >
          {dark ? '☾' : '☀'}
        </button>
      </header>
      <main>
        <ErrorBoundary key={path}>
          <Page />
        </ErrorBoundary>
      </main>
      <NavBar tabs={TABS} current={path} variant="bottom" />
    </div>
  )
}
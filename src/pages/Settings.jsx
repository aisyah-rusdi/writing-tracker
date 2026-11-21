import { useState } from 'react'
import ConnectionCard from '../components/ConnectionCard'
import DataCard from '../components/DataCard'
import PreferencesCard from '../components/PreferencesCard'
import ProjectsCard from '../components/ProjectsCard'
import { isConfigured } from '../lib/api'
import { useEntries } from '../hooks/useEntries'
import { useProjects } from '../hooks/useProjects'
import { useSettings } from '../hooks/useSettings'

export default function Settings() {
  const { projects, loading, error, refresh, add, update, setArchived } = useProjects()
  const { reset } = useEntries()
  const [settings, change] = useSettings()
  // Re-draw after connecting or disconnecting, so the Projects card follows.
  const [, redraw] = useState(0)

  // Two columns on wide screens: Connection and Data on the left, Preferences
  // above Projects on the right. On phones the columns melt away and the cards
  // follow the order set in components.css (Connection, Projects, Preferences, Data).
  return (
    <div className="settings">
      <h1>Settings</h1>
      <div className="settings-grid">
        <div className="settings-col">
          <ConnectionCard
            onConnected={() => {
              redraw((n) => n + 1)
              refresh()
            }}
            onDisconnected={() => {
              reset()
              redraw((n) => n + 1)
            }}
          />
          <DataCard
            projects={projects}
            loading={loading}
            configured={isConfigured()}
            onImported={refresh}
          />
        </div>
        <div className="settings-col">
          <PreferencesCard settings={settings} onChange={change} />
          <ProjectsCard
            projects={projects}
            loading={loading}
            error={error}
            configured={isConfigured()}
            onAdd={add}
            onUpdate={update}
            onArchive={setArchived}
            onRetry={refresh}
          />
        </div>
      </div>
    </div>
  )
}
import { WEEK_STARTS } from '../hooks/useSettings'

export default function PreferencesCard({ settings, onChange }) {
  return (
    <section className="card settings-pref">
      <h2>Preferences</h2>
      <label className="field">
        <span>Week starts on</span>
        <select
          value={settings.weekStart}
          onChange={(e) => onChange('weekStart', Number(e.target.value))}
        >
          {WEEK_STARTS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Theme</span>
        <select value={settings.theme} onChange={(e) => onChange('theme', e.target.value)}>
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <label className="check">
        <span>Goal celebration</span>
        <input
          type="checkbox"
          checked={settings.celebration}
          onChange={(e) => onChange('celebration', e.target.checked)}
        />
      </label>
    </section>
  )
}
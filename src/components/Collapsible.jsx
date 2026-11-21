import { useId, useState } from 'react'
import { getPref, setPref } from '../lib/prefs'

// A Settings card that opens and closes from its title.
//   id:          remembers open or closed on this device (lib/prefs.js)
//   defaultOpen: used until the person has chosen once
//   badge:       small element that stays visible in the header while closed
//
// The content stays on the page while closed (it is only hidden), so typed
// fields, an import preview or a running import are not lost when it is folded.
export default function Collapsible({
  id,
  title,
  badge = null,
  defaultOpen = false,
  className = '',
  children,
}) {
  const bodyId = useId()
  const [open, setOpen] = useState(() => {
    const saved = getPref('settingsOpen', {})
    return saved && typeof saved[id] === 'boolean' ? saved[id] : defaultOpen
  })

  function toggle() {
    const next = !open
    setOpen(next)
    setPref('settingsOpen', { ...getPref('settingsOpen', {}), [id]: next })
  }

  return (
    <section className={`card collapsible ${className}`.trim()}>
      <div className="collapsible__head">
        <h2>
          <button
            type="button"
            className="collapsible__toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={toggle}
          >
            <span>{title}</span>
            <span className="collapsible__chev" aria-hidden="true" />
          </button>
        </h2>
        {badge}
      </div>
      <div id={bodyId} className="collapsible__body" hidden={!open}>
        {children}
      </div>
    </section>
  )
}
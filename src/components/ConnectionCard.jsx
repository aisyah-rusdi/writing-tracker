import { useEffect, useState } from 'react'
import {
  clearConnection,
  describeError,
  getConnection,
  isConfigured,
  looksLikeScriptUrl,
  ping,
  saveConnection,
} from '../lib/api'

import Collapsible from './Collapsible'

// Asks the script to answer, and reports the outcome without throwing.
async function check() {
  try {
    return { data: await ping() }
  } catch (err) {
    return { err }
  }
}

const BADGES = {
  none: ['badge--syncing', 'Not set up'],
  checking: ['badge--syncing', 'Checking…'],
  ok: ['badge--saved', 'Connected'],
  failed: ['badge--failed', 'Not connected'],
}

export default function ConnectionCard({ onConnected, onDisconnected }) {
  const saved = getConnection()
  const [url, setUrl] = useState(saved.url)
  const [passphrase, setPassphrase] = useState(saved.passphrase)
  const [showPass, setShowPass] = useState(false)
  const [status, setStatus] = useState(isConfigured() ? 'checking' : 'none')
  const [info, setInfo] = useState(null)
  const [problem, setProblem] = useState(null) // { title, message }

  // On opening Settings, test the saved connection so the badge is honest.
  useEffect(() => {
    if (!isConfigured()) return
    let cancelled = false
    check().then(({ data, err }) => {
      if (cancelled) return
      if (err) {
        setProblem(describeError(err))
        setStatus('failed')
      } else {
        setInfo(data)
        setStatus('ok')
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setProblem(null)
    if (!looksLikeScriptUrl(url)) {
      setProblem({
        title: 'That doesn’t look like a script link',
        message: 'It should start with https://script.google.com and end in /exec.',
      })
      return
    }
    if (!passphrase.trim()) {
      setProblem({ title: 'Passphrase needed', message: 'Type the passphrase you set for the script.' })
      return
    }
    try {
      saveConnection({ url, passphrase })
    } catch (err) {
      setProblem(describeError(err))
      return
    }
    setStatus('checking')
    const { data, err } = await check()
    if (err) {
      setProblem(describeError(err))
      setInfo(null)
      setStatus('failed')
    } else {
      setInfo(data)
      setStatus('ok')
      if (onConnected) onConnected()
    }
  }

  function handleDisconnect() {
    if (!window.confirm('Remove the connection from this device? Your data stays in the sheet.')) return
    clearConnection()
    setUrl('')
    setPassphrase('')
    setInfo(null)
    setProblem(null)
    setStatus('none')
    if (onDisconnected) onDisconnected()
  }

  const [badgeClass, badgeText] = BADGES[status]

  return (
    <Collapsible
      id="connection"
      title="Connection"
      className="settings-conn"
      defaultOpen={!isConfigured()}
      badge={<span className={`badge ${badgeClass}`}>{badgeText}</span>}
    >
      {status === 'ok' && info && info.timezone && (
        <p className="mut settings__tz">Sheet time zone: {info.timezone}</p>
      )}

      {problem && (
        <div className="banner banner--error" role="alert">
          <b>{problem.title}</b>
          {problem.message}
        </div>
      )}

      <form onSubmit={handleSave}>
        <label className="field">
          <span>Apps Script URL</span>
          <input
            value={url}
            placeholder="https://script.google.com/macros/s/…/exec"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Passphrase</span>
          <input
            type={showPass ? 'text' : 'password'}
            value={passphrase}
            autoComplete="off"
            onChange={(e) => setPassphrase(e.target.value)}
          />
        </label>
        <p>
          <button type="button" className="btn sec btn--sm" onClick={() => setShowPass((v) => !v)}>
            {showPass ? 'Hide passphrase' : 'Show passphrase'}
          </button>
        </p>
        <p className="hint">Saved only in this browser. Type it once on each device.</p>
        <div className="form-actions">
          <button type="submit" className="btn" disabled={status === 'checking'}>
            Save and test
          </button>
          {isConfigured() && (
            <button type="button" className="btn sec" onClick={handleDisconnect}>
              Disconnect
            </button>
          )}
        </div>
      </form>
    </Collapsible>
  )
}
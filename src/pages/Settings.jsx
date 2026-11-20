import { useState } from 'react'
import {
  getConnection,
  saveConnection,
  clearConnection,
  looksLikeScriptUrl,
  ping,
  describeError,
} from '../lib/api.js'

// Small connection form for now. The full Settings page (projects, goals,
// theme, import/export) comes later in E11.
export default function Settings() {
  const [url, setUrl] = useState(() => getConnection().url)
  const [passphrase, setPassphrase] = useState(() => getConnection().passphrase)
  const [show, setShow] = useState(false)
  // null, or { kind: 'busy' | 'ok' | 'error', title, message }
  const [status, setStatus] = useState(null)

  async function handleSave(event) {
    event.preventDefault()

    if (!looksLikeScriptUrl(url)) {
      setStatus({
        kind: 'error',
        title: 'That doesn’t look like the web app URL',
        message: 'It should start with https://script.google.com/ and end with /exec.',
      })
      return
    }
    if (!passphrase.trim()) {
      setStatus({
        kind: 'error',
        title: 'Passphrase is empty',
        message: 'Type the passphrase you saved in the script’s Script Properties.',
      })
      return
    }

    try {
      saveConnection({ url, passphrase })
      setStatus({ kind: 'busy', title: 'Testing the connection…', message: '' })
      const result = await ping()
      setStatus({
        kind: 'ok',
        title: 'Connected',
        message: `The sheet’s time zone is ${result.timezone} and its date today is ${result.today}.`,
      })
    } catch (err) {
      const { title, message } = describeError(err)
      setStatus({ kind: 'error', title, message })
    }
  }

  function handleForget() {
    clearConnection()
    setUrl('')
    setPassphrase('')
    setStatus({
      kind: 'ok',
      title: 'Removed from this device',
      message: 'The URL and passphrase are no longer saved in this browser.',
    })
  }

  return (
    <div>
      <h1>Settings</h1>

      <h2>Connection</h2>
      <form onSubmit={handleSave}>
        <p>
          <label>
            Apps Script URL
            <br />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/…/exec"
              autoComplete="off"
              style={{ width: '100%', maxWidth: 520 }}
            />
          </label>
        </p>
        <p>
          <label>
            Passphrase
            <br />
            <input
              type={show ? 'text' : 'password'}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="off"
              style={{ width: '100%', maxWidth: 520 }}
            />
          </label>{' '}
          <button type="button" onClick={() => setShow(!show)}>
            {show ? 'Hide' : 'Show'}
          </button>
        </p>
        <p>
          <button type="submit">Save and test</button>{' '}
          <button type="button" onClick={handleForget}>
            Forget on this device
          </button>
        </p>
      </form>

      {status && (
        <p role="status">
          <strong>{status.title}</strong>
          {status.message ? ` ${status.message}` : ''}
        </p>
      )}

      <p style={{ opacity: 0.7 }}>
        These are saved only in this browser, never in the website’s code. Enter them once on each
        device you use.
      </p>
    </div>
  )
}
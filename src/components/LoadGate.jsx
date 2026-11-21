import { useEntries } from '../hooks/useEntries'
import { ApiError, describeError } from '../lib/api'

// Wraps a page's content. If the sheet could not be loaded:
//   - with nothing on screen yet, it shows only the banner, so the page never
//     claims "Nothing logged yet" when the truth is "couldn't load";
//   - with cached data, it shows the banner above the (possibly older) data.
// Same wording and buttons as the banner on Today.
export default function LoadGate({ children }) {
  const { entries, loading, loadError, refresh } = useEntries()

  let banner = null
  if (loadError) {
    const { title, message } = describeError(loadError)
    const code = loadError instanceof ApiError ? loadError.code : ''
    const needsSettings = code === 'NOT_CONFIGURED' || code === 'BAD_PASSPHRASE'
    banner = (
      <div className={'banner ' + (code === 'NOT_CONFIGURED' ? 'banner--info' : 'banner--error')} role="alert">
        <b>{title}</b>
        {message}
        <div>
          {needsSettings ? (
            <a className="btn sec" href="#/settings" style={{ textDecoration: 'none' }}>
              Open Settings
            </a>
          ) : (
            <button type="button" className="btn sec" onClick={refresh}>
              Try again
            </button>
          )}
        </div>
      </div>
    )
  }

  if (banner && !loading && entries.length === 0) return banner
  return (
    <>
      {banner}
      {children}
    </>
  )
}
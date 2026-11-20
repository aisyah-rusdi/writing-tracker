// One entry in "Today", with its sync badge. A failed entry can be tapped to retry.
export default function EntryRow({ entry, project, onRetry }) {
  const status = entry.status || 'saved'
  return (
    <div className="entry">
      <span className="dot" style={{ background: project ? project.colour : '#BDB5A3' }} />
      <span>{project ? project.name : 'Unknown project'}</span>
      <span className="num entry__words">{entry.words.toLocaleString('en-US')}</span>
      {status === 'failed' ? (
        <button type="button" className="badge badge--failed" onClick={() => onRetry(entry.id)}>
          Not synced – tap to retry
        </button>
      ) : (
        <span className={`badge badge--${status}`}>{status === 'syncing' ? 'Syncing' : 'Saved'}</span>
      )}
    </div>
  )
}
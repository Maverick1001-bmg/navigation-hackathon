import type { ServerStatus } from './api'

type Props = {
  status: ServerStatus
  onRetry: () => void
}

// Tells everyone (judges included) whether the demo server behind the tunnel is reachable.
export default function ServerStatusChip({ status, onRetry }: Props) {
  const { state, engine } = status

  if (state === 'online') {
    return (
      <div className="server-chip server-chip--ok" role="status" title="Routing and reports are live">
        <span className="server-chip__dot" /> Live{engine ? ` · ${engine}` : ''}
      </div>
    )
  }

  const text = {
    checking: 'Connecting to the demo server…',
    none: 'Demo server not connected. Open the demo link to enable routing and reports.',
    offline: 'Server offline. Routing and reports paused.',
    'routing-down': 'Routing engine offline. Reports still work.',
  }[state]

  return (
    <div className={`server-chip server-chip--${state}`} role="status">
      <span className="server-chip__dot" />
      <span className="server-chip__text">{text}</span>
      {(state === 'offline' || state === 'routing-down') && (
        <button className="server-chip__btn" onClick={onRetry}>Retry</button>
      )}
    </div>
  )
}

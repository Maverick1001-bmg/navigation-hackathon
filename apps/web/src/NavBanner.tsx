import { formatDistance } from './photon'
import { formatDuration, type RouteStep } from './api'
import { maneuverArrow } from './navigation'

type BannerProps = {
  step: RouteStep | undefined
  /** The step after it, shown as "Then ↰" when it follows within 100 m. */
  next: RouteStep | undefined
  nextGapM: number | null
  /** Metres along the road to the upcoming maneuver. */
  toManeuver: number | null
}

/** Top banner while navigating: arrow, distance to the turn, instruction. */
export function NavBanner({ step, next, nextGapM, toManeuver }: BannerProps) {
  if (!step) return null
  return (
    <div className="nav-banner" role="status">
      <span className="nav-banner__arrow" aria-hidden>{maneuverArrow(step.text)}</span>
      <div className="nav-banner__main">
        {toManeuver !== null && (
          <span className="nav-banner__dist">{toManeuver < 20 ? 'Now' : formatDistance(toManeuver)}</span>
        )}
        <span className="nav-banner__text">{step.text}</span>
        {next && nextGapM !== null && nextGapM < 100 && (
          <span className="nav-banner__then">Then {maneuverArrow(next.text)}</span>
        )}
      </div>
    </div>
  )
}

type BarProps = { remainingS: number; remainingM: number; arriveAt: Date; onExit: () => void }

/** Bottom bar while navigating: time left, distance left, arrival time, exit. */
export function NavBar({ remainingS, remainingM, arriveAt, onExit }: BarProps) {
  const clock = arriveAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return (
    <div className="nav-bar" role="status">
      <div className="nav-bar__stat">
        <strong>{formatDuration(remainingS)}</strong>
        <small>left</small>
      </div>
      <div className="nav-bar__stat">
        <strong>{formatDistance(remainingM)}</strong>
        <small>distance</small>
      </div>
      <div className="nav-bar__stat">
        <strong>{clock}</strong>
        <small>arrival</small>
      </div>
      <button className="nav-bar__exit" onClick={onExit} aria-label="Exit navigation">✕</button>
    </div>
  )
}

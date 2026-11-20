import { useEffect, useRef } from 'react'
import { formatDistance } from './photon'
import type { LatLng, RouteStep } from './api'
import { distTo } from './currentStep'

type Props = {
  steps: RouteStep[]
  current: number
  userPos: LatLng | null
}

/** Turn-by-turn list under the route summary. The upcoming maneuver is highlighted. */
export default function TurnByTurn({ steps, current, userPos }: Props) {
  const currentRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [current])

  return (
    <ol className="steps" aria-label="Turn-by-turn directions">
      {steps.map((step, i) => {
        const isCurrent = i === current
        // For the upcoming step show how far away it is; otherwise its own length
        const dist = isCurrent && userPos ? distTo(userPos, step) : step.distanceM
        return (
          <li
            key={i}
            ref={isCurrent ? currentRef : undefined}
            className={`steps__item${isCurrent ? ' is-current' : ''}${i < current ? ' is-done' : ''}`}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span className="steps__text">{step.text}</span>
            {dist > 0 && (
              <span className="steps__dist">
                {isCurrent && userPos ? `in ${formatDistance(dist)}` : formatDistance(dist)}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

import { useEffect, useState } from 'react'
import { haversineM } from './photon'
import type { LatLng, RouteStep } from './api'

/** Within this distance of a maneuver point, that step counts as done. */
const PASSED_M = 30

export const distTo = (pos: LatLng, step: RouteStep) =>
  haversineM(pos.lat, pos.lng, step.location.lat, step.location.lng)

/**
 * The step whose maneuver is next: the closest maneuver point at or after the current
 * step, moving on once the user is within PASSED_M of it. Never moves backwards.
 * Starts again from the first step when the route changes.
 */
export function useCurrentStep(steps: RouteStep[] | undefined, userPos: LatLng | null): number {
  const [current, setCurrent] = useState(0)
  const [forSteps, setForSteps] = useState(steps)
  if (forSteps !== steps) {
    setForSteps(steps)
    setCurrent(0)
  }

  useEffect(() => {
    if (!steps?.length || !userPos) return
    setCurrent(cur => {
      let best = cur
      for (let i = cur + 1; i < steps.length; i++) {
        if (distTo(userPos, steps[i]) < distTo(userPos, steps[best])) best = i
      }
      while (best < steps.length - 1 && distTo(userPos, steps[best]) < PASSED_M) best++
      return best
    })
  }, [steps, userPos])

  return steps?.length ? Math.min(current, steps.length - 1) : 0
}

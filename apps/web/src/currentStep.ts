import { useEffect, useMemo, useState } from 'react'
import { haversineM } from './photon'
import type { LatLng, RouteStep } from './api'

/** Within this distance of a maneuver point, that step counts as done. */
const PASSED_M = 30
/** Also done once the user is this far along the route beyond the maneuver point. */
const PAST_M = 10

export const distTo = (pos: LatLng, step: RouteStep) =>
  haversineM(pos.lat, pos.lng, step.location.lat, step.location.lng)

// Flat x/y in metres around the route: plenty accurate over a city
const toXY = (p: LatLng, lat0: number) => ({
  x: ((p.lng * Math.PI) / 180) * 6_371_000 * Math.cos((lat0 * Math.PI) / 180),
  y: ((p.lat * Math.PI) / 180) * 6_371_000,
})

/** Distance along the route (metres from the start) of the route point nearest to p. */
function makeProgress(line: LatLng[]) {
  const lat0 = line[0]?.lat ?? 0
  const pts = line.map(p => toXY(p, lat0))
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  return (p: LatLng) => {
    const q = toXY(p, lat0)
    let best = Infinity
    let along = 0
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const dx = pts[i + 1].x - a.x
      const dy = pts[i + 1].y - a.y
      const len2 = dx * dx + dy * dy
      const t = len2 ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / len2)) : 0
      const d = Math.hypot(a.x + t * dx - q.x, a.y + t * dy - q.y)
      if (d < best) {
        best = d
        along = cum[i] + t * Math.sqrt(len2)
      }
    }
    return along
  }
}

/**
 * The step whose maneuver is next. A step is done once the user has been within
 * PASSED_M of its maneuver point, or is further along the route than it (so a GPS
 * jump past a turn still moves on). Never moves backwards; restarts on a new route.
 */
export function useCurrentStep(
  steps: RouteStep[] | undefined,
  polyline: LatLng[] | undefined,
  userPos: LatLng | null,
): number {
  const [current, setCurrent] = useState(0)
  const [forSteps, setForSteps] = useState(steps)
  if (forSteps !== steps) {
    setForSteps(steps)
    setCurrent(0)
  }

  const progress = useMemo(() => (polyline && polyline.length > 1 ? makeProgress(polyline) : null), [polyline])
  const stepAlong = useMemo(() => (progress && steps ? steps.map(s => progress(s.location)) : null), [progress, steps])

  useEffect(() => {
    if (!steps?.length || !userPos) return
    const userAlong = progress?.(userPos)
    const done = (i: number) =>
      distTo(userPos, steps[i]) < PASSED_M ||
      (userAlong !== undefined && !!stepAlong && userAlong > stepAlong[i] + PAST_M)
    setCurrent(cur => {
      let next = cur
      while (next < steps.length - 1 && done(next)) next++
      return next
    })
  }, [steps, userPos, progress, stepAlong])

  return steps?.length ? Math.min(current, steps.length - 1) : 0
}

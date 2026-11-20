import { useEffect, useMemo, useRef } from 'react'
import { haversineM } from './photon'
import { makeProjector } from './currentStep'
import type { LatLng, Route } from './api'

const OFF_ROUTE_M = 50
const OFF_ROUTE_FIXES = 2
const ARRIVE_M = 30

/** Arrow + short label for a step, from its text ("Turn left onto…", "Make a U-turn", …). */
export function maneuverArrow(text: string): string {
  const t = text.toLowerCase()
  if (/destination|arrive/.test(t)) return '⚑'
  if (/u-turn|u turn/.test(t)) return '↩'
  if (/sharp left/.test(t)) return '↰'
  if (/sharp right/.test(t)) return '↱'
  if (/left/.test(t)) return '←'
  if (/right/.test(t)) return '→'
  return '↑' // continue / head / drive straight
}

/**
 * Live progress along the route while navigating: distance to the next maneuver, distance and
 * time left, arrival time, the driven/ahead split of the line, off-route and arrival detection.
 */
export function useNavProgress(
  route: Route | null,
  userPos: LatLng | null,
  currentStep: number,
  active: boolean,
  onOffRoute: (from: LatLng) => void,
  onArrive: () => void,
) {
  const polyline = route?.polyline
  const proj = useMemo(() => (polyline && polyline.length > 1 ? makeProjector(polyline) : null), [polyline])
  const stepAlong = useMemo(
    () => (proj && route?.steps ? route.steps.map(s => proj.project(s.location).along) : null),
    [proj, route?.steps],
  )

  const here = proj && userPos ? proj.project(userPos) : null
  const userAlong = here?.along ?? 0
  const remainingM = proj ? Math.max(0, proj.total - userAlong) : 0
  const remainingS = route && proj && proj.total > 0 ? route.durationS * (remainingM / proj.total) : 0
  const toManeuver = stepAlong && here ? Math.max(0, stepAlong[currentStep] - userAlong) : null
  const split = useMemo(
    () => (active && proj && here ? proj.split(here.along) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, proj, here?.along],
  )

  // Off route: 2 fixes in a row more than 50 m from the line. Arrive: within 30 m of the end.
  const offCount = useRef(0)
  const rerouting = useRef(false)
  const cbs = useRef({ onOffRoute, onArrive })
  cbs.current = { onOffRoute, onArrive }
  useEffect(() => {
    offCount.current = 0
    rerouting.current = false
  }, [route, active])

  useEffect(() => {
    if (!active || !proj || !polyline || !userPos || !here) return
    const end = polyline[polyline.length - 1]
    if (haversineM(userPos.lat, userPos.lng, end.lat, end.lng) < ARRIVE_M) {
      cbs.current.onArrive()
      return
    }
    offCount.current = here.off > OFF_ROUTE_M ? offCount.current + 1 : 0
    if (offCount.current >= OFF_ROUTE_FIXES && !rerouting.current) {
      rerouting.current = true
      offCount.current = 0
      cbs.current.onOffRoute(userPos)
      // Allow another try if the reroute fails and the route never changes
      setTimeout(() => { rerouting.current = false }, 10_000)
    }
    // Runs once per GPS fix
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPos])

  const arriveAt = new Date(Date.now() + remainingS * 1000)
  return { toManeuver, remainingM, remainingS, arriveAt, split }
}

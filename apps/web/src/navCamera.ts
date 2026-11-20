import { useEffect, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { bearing, type LatLng } from './api'
import { haversineM } from './photon'

// 3D view (from Lume): the map tilts to TILT_3D. While a route is showing and GPS is on,
// the 3D view also becomes a driving camera: it follows you, heading-up, looking along
// the road ahead, with your dot in the lower part of the screen.

const TILT_3D = 55
const NAV_TILT = 60
const NAV_ZOOM = 17
/** Look this far along the route to decide which way is "up". */
const LOOK_AHEAD_M = 40

/** 2D/3D state, kept in sync with two-finger tilt gestures. */
export function use3D(map: MapLibreMap | null) {
  const [is3D, setIs3D] = useState(false)
  useEffect(() => {
    if (!map) return
    const sync = () => setIs3D(map.getPitch() > 5)
    map.on('pitchend', sync)
    return () => {
      map.off('pitchend', sync)
    }
  }, [map])

  const toggle = () => {
    const next = !is3D
    setIs3D(next)
    if (next) map?.easeTo({ pitch: TILT_3D, duration: 500 })
    else map?.easeTo({ pitch: 0, bearing: 0, duration: 500 })
  }
  return { is3D, toggle }
}

/** Which way the route goes from where the user is: bearing to a point LOOK_AHEAD_M ahead. */
function headingAlong(route: LatLng[], pos: LatLng): number | null {
  if (route.length < 2) return null
  let nearest = 0
  let best = Infinity
  for (let i = 0; i < route.length; i++) {
    const d = haversineM(pos.lat, pos.lng, route[i].lat, route[i].lng)
    if (d < best) {
      best = d
      nearest = i
    }
  }
  for (let i = nearest + 1; i < route.length; i++) {
    if (haversineM(pos.lat, pos.lng, route[i].lat, route[i].lng) >= LOOK_AHEAD_M) return bearing(pos, route[i])
  }
  return nearest > 0 ? bearing(route[nearest - 1], route[nearest]) : null
}

/**
 * Driving camera: while `active`, every GPS fix moves the camera to follow the user.
 * Dragging the map pauses following; it resumes when `active` turns on again or
 * resume() is called.
 */
export function useNavCamera(
  map: MapLibreMap | null,
  active: boolean,
  polyline: LatLng[] | null,
  userPos: LatLng | null,
) {
  const [paused, setPaused] = useState(false)
  const [wasActive, setWasActive] = useState(active)
  if (wasActive !== active) {
    setWasActive(active)
    if (active) setPaused(false)
  }

  useEffect(() => {
    if (!map || !active) return
    const onDrag = () => setPaused(true)
    map.on('dragstart', onDrag)
    return () => {
      map.off('dragstart', onDrag)
    }
  }, [map, active])

  const following = active && !paused && !!polyline && !!userPos
  useEffect(() => {
    if (!map || !following || !polyline || !userPos) return
    const heading = headingAlong(polyline, userPos)
    // Keep the user's dot above the bottom sheet on phones
    const card = document.querySelector<HTMLElement>('.place-card')
    const covered = window.innerWidth < 700 && card ? card.offsetHeight : 0
    map.easeTo({
      center: [userPos.lng, userPos.lat],
      zoom: NAV_ZOOM,
      pitch: NAV_TILT,
      bearing: heading ?? map.getBearing(),
      padding: { top: 120, bottom: covered + 40, left: 0, right: 0 },
      duration: 900,
    })
  }, [map, following, polyline, userPos])

  return { following, paused: active && paused, resume: () => setPaused(false) }
}

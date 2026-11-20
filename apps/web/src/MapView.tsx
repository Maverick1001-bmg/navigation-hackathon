import { useEffect, useRef } from 'react'
import {
  Map as MapLibreMap,
  NavigationControl,
  GeolocateControl,
  ScaleControl,
  setWorkerUrl,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre 6 loads its worker from a separate file next to its own script. Once bundled,
// that file is missing, so ship it as a Vite asset and point MapLibre at it.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { applyMapTheme, setupNavLayers, type MapTheme } from './mapTheme'

setWorkerUrl(maplibreWorkerUrl)

// Free OpenStreetMap vector tiles, no API key. Recoloured light/dark by mapTheme.ts.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

// Kuala Lumpur: shown until (or if) GPS gives us the user's location
const START_CENTER: [number, number] = [101.6869, 3.139] // [lng, lat]
const START_ZOOM = 11

const GPS_WATCHDOG_MS = 12_000 // no fix by then → treat as unavailable

type Props = {
  theme: MapTheme
  onMapReady?: (map: MapLibreMap) => void
  /** GPS is unavailable (blocked, no signal, timed out, unsupported). */
  onLocationError?: (message: string) => void
  /** Called on every GPS fix. */
  onUserLocation?: (pos: { lng: number; lat: number }) => void
  /** Change this number to retry GPS. */
  gpsRetry?: number
}

export default function MapView({ theme, onMapReady, onLocationError, onUserLocation, gpsRetry = 0 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const startGpsRef = useRef<(() => void) | null>(null)
  const themeRef = useRef(theme)
  themeRef.current = theme
  const callbacks = useRef({ onMapReady, onLocationError, onUserLocation })
  callbacks.current = { onMapReady, onLocationError, onUserLocation }

  useEffect(() => {
    if (!containerRef.current) return

    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE,
      center: START_CENTER,
      zoom: START_ZOOM,
    })
    mapRef.current = map

    map.addControl(new NavigationControl(), 'top-right')

    // GPS: "you are here" dot that follows the user. Started automatically on load;
    // the button (top right) toggles following on/off.
    const geolocate = new GeolocateControl({
      positionOptions: { enableHighAccuracy: true, timeout: 10_000 },
      trackUserLocation: true,
      showAccuracyCircle: true,
      fitBoundsOptions: { maxZoom: 15 },
    })
    map.addControl(geolocate, 'top-right')

    // GPS can fail silently: if the site is blocked, MapLibre just disables its button
    // with no error event, and an unanswered permission prompt never resolves. So we
    // check the permission ourselves and run a watchdog.
    let gotFix = false
    let watchdog: ReturnType<typeof setTimeout> | undefined
    const fail = (message: string) => {
      clearTimeout(watchdog)
      if (!gotFix) callbacks.current.onLocationError?.(message)
    }
    geolocate.on('geolocate', (e: { coords: GeolocationCoordinates }) => {
      gotFix = true
      clearTimeout(watchdog)
      callbacks.current.onUserLocation?.({ lng: e.coords.longitude, lat: e.coords.latitude })
    })
    geolocate.on('error', (e: { code?: number }) => {
      fail(e.code === 1 ? 'Location is blocked for this site.' : "Couldn't get a GPS signal.")
    })

    const startGps = async () => {
      if (!('geolocation' in navigator)) return fail('This browser has no GPS.')
      if (!window.isSecureContext) return fail('Location needs https.')
      try {
        const perm = await navigator.permissions?.query({ name: 'geolocation' })
        if (perm?.state === 'denied') return fail('Location is blocked for this site.')
      } catch { /* Permissions API missing (older Safari): just try */ }
      gotFix = false
      clearTimeout(watchdog)
      watchdog = setTimeout(() => fail("Couldn't get your location."), GPS_WATCHDOG_MS)
      geolocate.trigger()
    }
    startGpsRef.current = startGps

    map.addControl(new ScaleControl(), 'bottom-left')

    map.on('style.load', () => {
      setupNavLayers(map)
      applyMapTheme(map, themeRef.current)
    })
    map.on('load', () => {
      callbacks.current.onMapReady?.(map)
      startGps()
    })

    return () => {
      clearTimeout(watchdog)
      startGpsRef.current = null
      mapRef.current = null
      map.remove()
    }
  }, [])

  // Retry GPS on request (e.g. the "Retry" button in the location-off bar)
  useEffect(() => {
    if (gpsRetry > 0) startGpsRef.current?.()
  }, [gpsRetry])

  // Re-theme in place when the toggle changes
  useEffect(() => {
    const map = mapRef.current
    if (map?.isStyleLoaded()) applyMapTheme(map, theme)
  }, [theme])

  return <div ref={containerRef} className={`map map--${theme}`} />
}

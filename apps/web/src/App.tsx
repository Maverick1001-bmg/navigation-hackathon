import { useCallback, useEffect, useRef, useState } from 'react'
import { LngLatBounds, Marker, type Map as MapLibreMap } from 'maplibre-gl'
import MapView from './MapView'
import SearchBox from './SearchBox'
import PlaceCard from './PlaceCard'
import { addSearchLayer, type SearchLayer } from './searchLayer'
import { addRouteLayer, type RouteLayer } from './routeLayer'
import {
  checkServer, confirmIncident, fetchRoute, listIncidents, reportIncident,
  type IncidentType, type Route, type ServerStatus,
} from './api'
import ServerStatusChip from './ServerStatusChip'
import { createIncidentMarkers, INCIDENT_INFO, type IncidentMarkers } from './incidents'
import ReportButton from './ReportButton'
import { useCurrentStep } from './currentStep'
import { useTransit } from './transit/useTransit' // transit

const INCIDENT_POLL_MS = 5000
const SERVER_CHECK_MS = 20_000
import type { MapTheme } from './mapTheme'
import type { Place } from './photon'

const systemTheme = (): MapTheme =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

const KL = { lng: 101.6869, lat: 3.139 }
// Not blue (route) or red (incidents)
const PLACE_PIN_COLOUR = '#8b5cf6'

// Keep fitted results clear of the search dropdown (top-left on desktop, top on phones)
const fitPadding = () =>
  window.innerWidth >= 700
    ? { top: 60, bottom: 40, left: 440, right: 60 }
    : { top: 340, bottom: 40, left: 30, right: 50 }

export default function App() {
  const [theme, setTheme] = useState<MapTheme>(systemTheme)
  const [map, setMap] = useState<MapLibreMap | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null) // routing destination
  const [cardOpen, setCardOpen] = useState(false)
  const [userPos, setUserPos] = useState<{ lng: number; lat: number } | null>(null)
  const [route, setRoute] = useState<Route | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const currentStep = useCurrentStep(route?.steps, userPos)
  const pinRef = useRef<Marker | null>(null)
  const searchLayerRef = useRef<SearchLayer | null>(null)
  const routeLayerRef = useRef<RouteLayer | null>(null)
  const routeAbort = useRef<AbortController | null>(null)
  const incidentsRef = useRef<IncidentMarkers | null>(null)
  const [server, setServer] = useState<ServerStatus>({ state: 'checking' })
  // Reports work whenever the API answers, even if the routing engine is down
  const apiOnline = server.state === 'online' || server.state === 'routing-down'

  // ── Location: GPS, or a position the user taps on the map when GPS is unavailable ──
  const [gpsProblem, setGpsProblem] = useState<string | null>(null)
  const [gpsRetry, setGpsRetry] = useState(0)
  const [pickingLocation, setPickingLocation] = useState(false)
  const manualPinRef = useRef<Marker | null>(null)

  const onGpsFix = useCallback((pos: { lng: number; lat: number }) => {
    setUserPos(pos)
    setGpsProblem(null)
    setPickingLocation(false)
    manualPinRef.current?.remove()
    manualPinRef.current = null
  }, [])

  const retryGps = useCallback(() => {
    setGpsProblem(null)
    setGpsRetry(n => n + 1)
  }, [])

  useEffect(() => {
    if (!map || !pickingLocation) return
    const canvas = map.getCanvas()
    canvas.style.cursor = 'crosshair'
    const onClick = (e: { lngLat: { lng: number; lat: number } }) => {
      const pos = { lng: e.lngLat.lng, lat: e.lngLat.lat }
      manualPinRef.current?.remove()
      const el = document.createElement('div')
      el.className = 'manual-location'
      manualPinRef.current = new Marker({ element: el }).setLngLat([pos.lng, pos.lat]).addTo(map)
      setUserPos(pos)
      setGpsProblem(null)
      setPickingLocation(false)
      setNotice('Location set. Directions and reports will start here.')
    }
    map.once('click', onClick)
    return () => {
      map.off('click', onClick)
      canvas.style.cursor = ''
    }
  }, [map, pickingLocation])

  const clearRoute = useCallback(() => {
    routeAbort.current?.abort()
    setRoute(null)
    setRouteLoading(false)
    routeLayerRef.current?.setRoute(null)
    incidentsRef.current?.setOnRoute([])
  }, [])

  // ── Server status: keep checking, so a dead tunnel or engine shows up in the app ──
  const checking = useRef(false)
  const recheckServer = useCallback(async () => {
    if (checking.current) return
    checking.current = true
    try {
      setServer(await checkServer())
    } finally {
      checking.current = false
    }
  }, [])

  useEffect(() => {
    recheckServer()
    const timer = setInterval(recheckServer, SERVER_CHECK_MS)
    // Phones pause background tabs: check again as soon as the app is visible
    const onVisible = () => document.visibilityState === 'visible' && recheckServer()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', recheckServer)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', recheckServer)
    }
  }, [recheckServer])

  // ── Incidents: poll while the API is up, so every phone sees new reports ──
  const refreshIncidents = useCallback(async () => {
    try {
      incidentsRef.current?.set(await listIncidents())
    } catch { /* keep showing the last list; next poll retries */ }
  }, [])

  useEffect(() => {
    if (!map || !apiOnline) return
    const markers = createIncidentMarkers(map, async id => {
      try {
        await confirmIncident(id)
        refreshIncidents()
      } catch (err) {
        setNotice((err as Error).message)
      }
    })
    incidentsRef.current = markers
    refreshIncidents()
    const timer = setInterval(refreshIncidents, INCIDENT_POLL_MS)
    return () => {
      clearInterval(timer)
      incidentsRef.current = null
      markers.remove()
    }
  }, [map, apiOnline, refreshIncidents])

  const report = useCallback(
    async (type: IncidentType) => {
      const at = userPos ?? map?.getCenter()
      if (!at) return
      try {
        await reportIncident(type, { lat: at.lat, lng: at.lng })
        setNotice(`${INCIDENT_INFO[type].emoji} ${INCIDENT_INFO[type].label} reported${userPos ? '' : ' at the map centre'}. Thanks!`)
        refreshIncidents()
      } catch (err) {
        setNotice((err as Error).message)
      }
    },
    [map, userPos, refreshIncidents],
  )

  // Auto-hide notices
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(t)
  }, [notice])

  const getBias = useCallback(() => map?.getCenter() ?? KL, [map])

  const transit = useTransit(map, { onOpen: () => setCardOpen(false), fitPadding }) // transit
  const closeTransit = transit.close // transit

  const showPlace = useCallback(
    (place: Place) => {
      clearRoute()
      closeTransit() // transit
      setSelectedPlace(place)
      setCardOpen(true)
      if (!map) return
      searchLayerRef.current?.setResults([])
      pinRef.current?.remove()
      const pin = new Marker({ color: PLACE_PIN_COLOUR })
        .setLngLat([place.lng, place.lat])
        .addTo(map)
      // Clicking the pin reopens the card after it's been closed
      const el = pin.getElement()
      el.style.cursor = 'pointer'
      el.addEventListener('click', e => {
        e.stopPropagation()
        closeTransit() // transit
        setCardOpen(true)
      })
      pinRef.current = pin
      if (place.bbox) {
        const [w, s, e, n] = place.bbox
        map.fitBounds([[w, s], [e, n]], { padding: 80, maxZoom: 17 })
      } else {
        map.flyTo({ center: [place.lng, place.lat], zoom: 16 })
      }
    },
    [map, clearRoute, closeTransit],
  )

  // App layers, created once the map has loaded. Route first so result dots draw on top.
  // Clicking a result dot picks that place.
  const showPlaceRef = useRef(showPlace)
  showPlaceRef.current = showPlace
  useEffect(() => {
    if (!map) return
    const routeLayer = addRouteLayer(map)
    const searchLayer = addSearchLayer(map, place => showPlaceRef.current(place))
    routeLayerRef.current = routeLayer
    searchLayerRef.current = searchLayer
    return () => {
      routeLayerRef.current = null
      searchLayerRef.current = null
      // The map may already be destroyed (MapView unmount); nothing to clean then
      try { searchLayer.remove(); routeLayer.remove() } catch { /* map gone */ }
    }
  }, [map])

  const showResults = useCallback(
    (all: Place[], listed: Place[]) => {
      searchLayerRef.current?.setResults(all)
      if (!map || listed.length === 0) return
      const bounds = new LngLatBounds()
      for (const p of listed) bounds.extend([p.lng, p.lat])
      map.fitBounds(bounds, { padding: fitPadding(), maxZoom: 15, duration: 600 })
    },
    [map],
  )

  const highlight = useCallback((place: Place | null) => {
    searchLayerRef.current?.setActive(place?.id ?? null)
  }, [])

  // Directions: from GPS position (or map centre if GPS is off) to the selected place.
  const startDirections = useCallback(
    async (place: Place) => {
      if (!map) return
      routeAbort.current?.abort()
      const ctrl = new AbortController()
      routeAbort.current = ctrl
      const from = userPos ?? map.getCenter()
      if (!userPos) setNotice('No GPS fix: routing from the map centre.')
      setRouteLoading(true)
      try {
        const r = await fetchRoute({ lat: from.lat, lng: from.lng }, { lat: place.lat, lng: place.lng }, ctrl.signal)
        setRoute(r)
        routeLayerRef.current?.setRoute(r.polyline)
        incidentsRef.current?.setOnRoute(r.incidentsOnRoute ?? [])
        const bounds = new LngLatBounds()
        for (const p of r.polyline) bounds.extend([p.lng, p.lat])
        map.fitBounds(bounds, { padding: fitPadding(), maxZoom: 16, duration: 800 })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setNotice((err as Error).message)
      } finally {
        if (routeAbort.current === ctrl) setRouteLoading(false)
      }
    },
    [map, userPos],
  )

  const clearPlace = useCallback(() => {
    clearRoute()
    setSelectedPlace(null)
    setCardOpen(false)
    searchLayerRef.current?.setResults([])
    pinRef.current?.remove()
    pinRef.current = null
  }, [clearRoute])

  return (
    <div className={`app app--${theme}`}>
      <MapView
        theme={theme}
        onMapReady={setMap}
        onLocationError={setGpsProblem}
        onUserLocation={onGpsFix}
        gpsRetry={gpsRetry}
      />

      {/* Bottom-left: server status + location problems (hidden behind the card on phones) */}
      <div className={`status-stack${selectedPlace && cardOpen ? ' status-stack--card-open' : ''}`}>
      <ServerStatusChip status={server} onRetry={recheckServer} />
      {(gpsProblem || pickingLocation) && !(selectedPlace && cardOpen) && (
        <div className="location-bar" role="status">
          {pickingLocation ? (
            <>
              <span className="location-bar__text">👆 Tap the map where you are</span>
              <button className="location-bar__btn" onClick={() => setPickingLocation(false)}>Cancel</button>
            </>
          ) : (
            <>
              <span className="location-bar__text">
                📍 {gpsProblem} Showing Kuala Lumpur.
                {gpsProblem?.includes('blocked') && (
                  <small> Allow location for this site in your browser settings, then Retry.</small>
                )}
              </span>
              <span className="location-bar__actions">
                <button className="location-bar__btn" onClick={retryGps}>Retry</button>
                <button className="location-bar__btn location-bar__btn--primary" onClick={() => setPickingLocation(true)}>
                  Set on map
                </button>
              </span>
            </>
          )}
        </div>
      )}
      </div>

      <SearchBox
        getBias={getBias}
        onSelect={place => {
          // transit: a search result that is a rail station opens the station card instead
          if (transit.openStationForPlace(place)) { searchLayerRef.current?.setResults([]); return }
          showPlace(place)
        }}
        onClear={clearPlace}
        onResults={showResults}
        onActive={highlight}
        picked={selectedPlace}
      />

      {selectedPlace && cardOpen && (
        <PlaceCard
          place={selectedPlace}
          userPos={userPos}
          onClose={() => setCardOpen(false)}
          onDirections={startDirections}
          onShared={setNotice}
          route={route}
          routeLoading={routeLoading}
          onClearRoute={clearRoute}
          currentStep={currentStep}
        />
      )}

      {transit.card /* transit */}

      {apiOnline && (
        <ReportButton onReport={report} hidden={!!selectedPlace && cardOpen} />
      )}

      <button
        className="theme-toggle"
        onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} map`}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} map`}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { LngLatBounds, Marker, type Map as MapLibreMap } from 'maplibre-gl'
import MapView from './MapView'
import SearchBox from './SearchBox'
import PlaceCard from './PlaceCard'
import { addSearchLayer, type SearchLayer } from './searchLayer'
import { addRouteLayer, type RouteLayer } from './routeLayer'
import { fetchRoute, type Route } from './api'
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
  const pinRef = useRef<Marker | null>(null)
  const searchLayerRef = useRef<SearchLayer | null>(null)
  const routeLayerRef = useRef<RouteLayer | null>(null)
  const routeAbort = useRef<AbortController | null>(null)

  const clearRoute = useCallback(() => {
    routeAbort.current?.abort()
    setRoute(null)
    setRouteLoading(false)
    routeLayerRef.current?.setRoute(null)
  }, [])

  // Auto-hide notices
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(t)
  }, [notice])

  const getBias = useCallback(() => map?.getCenter() ?? KL, [map])

  const showPlace = useCallback(
    (place: Place) => {
      clearRoute()
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
    [map, clearRoute],
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
        onLocationError={setNotice}
        onUserLocation={setUserPos}
      />

      <SearchBox
        getBias={getBias}
        onSelect={showPlace}
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
        />
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

import { useCallback, useEffect, useRef, useState } from 'react'
import { LngLatBounds, Marker, type Map as MapLibreMap } from 'maplibre-gl'
import MapView from './MapView'
import SearchBox from './SearchBox'
import { addSearchLayer, type SearchLayer } from './searchLayer'
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
  const pinRef = useRef<Marker | null>(null)
  const searchLayerRef = useRef<SearchLayer | null>(null)

  // Auto-hide notices
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(t)
  }, [notice])

  const getBias = useCallback(() => map?.getCenter() ?? KL, [map])

  const showPlace = useCallback(
    (place: Place) => {
      setSelectedPlace(place)
      if (!map) return
      searchLayerRef.current?.setResults([])
      pinRef.current?.remove()
      pinRef.current = new Marker({ color: PLACE_PIN_COLOUR })
        .setLngLat([place.lng, place.lat])
        .addTo(map)
      if (place.bbox) {
        const [w, s, e, n] = place.bbox
        map.fitBounds([[w, s], [e, n]], { padding: 80, maxZoom: 17 })
      } else {
        map.flyTo({ center: [place.lng, place.lat], zoom: 16 })
      }
    },
    [map],
  )

  // Result dots layer: created once the map has loaded; clicking a dot picks that place
  const showPlaceRef = useRef(showPlace)
  showPlaceRef.current = showPlace
  useEffect(() => {
    if (!map) return
    const layer = addSearchLayer(map, place => showPlaceRef.current(place))
    searchLayerRef.current = layer
    return () => {
      searchLayerRef.current = null
      // The map may already be destroyed (MapView unmount); nothing to clean then
      try { layer.remove() } catch { /* map gone */ }
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

  const clearPlace = useCallback(() => {
    setSelectedPlace(null)
    searchLayerRef.current?.setResults([])
    pinRef.current?.remove()
    pinRef.current = null
  }, [])

  return (
    <div className={`app app--${theme}`}>
      <MapView theme={theme} onMapReady={setMap} onLocationError={setNotice} />

      <SearchBox
        getBias={getBias}
        onSelect={showPlace}
        onClear={clearPlace}
        onResults={showResults}
        onActive={highlight}
        picked={selectedPlace}
      />

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

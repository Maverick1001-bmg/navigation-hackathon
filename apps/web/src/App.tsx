import { useCallback, useEffect, useRef, useState } from 'react'
import { Marker, type Map as MapLibreMap } from 'maplibre-gl'
import MapView from './MapView'
import SearchBox from './SearchBox'
import type { MapTheme } from './mapTheme'
import type { Place } from './photon'

const systemTheme = (): MapTheme =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

const KL = { lng: 101.6869, lat: 3.139 }
// Not blue (route) or red (incidents)
const PLACE_PIN_COLOUR = '#8b5cf6'

export default function App() {
  const [theme, setTheme] = useState<MapTheme>(systemTheme)
  const [map, setMap] = useState<MapLibreMap | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [, setSelectedPlace] = useState<Place | null>(null) // for routing to use next
  const pinRef = useRef<Marker | null>(null)

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

  const clearPlace = useCallback(() => {
    setSelectedPlace(null)
    pinRef.current?.remove()
    pinRef.current = null
  }, [])

  return (
    <div className={`app app--${theme}`}>
      <MapView theme={theme} onMapReady={setMap} onLocationError={setNotice} />

      <SearchBox getBias={getBias} onSelect={showPlace} onClear={clearPlace} />

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

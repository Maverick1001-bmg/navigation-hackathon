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

type Props = {
  theme: MapTheme
  onMapReady?: (map: MapLibreMap) => void
  onLocationError?: (message: string) => void
}

export default function MapView({ theme, onMapReady, onLocationError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const themeRef = useRef(theme)
  themeRef.current = theme
  const callbacks = useRef({ onMapReady, onLocationError })
  callbacks.current = { onMapReady, onLocationError }

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
    geolocate.on('error', (e: { code?: number }) => {
      callbacks.current.onLocationError?.(
        e.code === 1
          ? 'Location permission is off. Showing Kuala Lumpur.'
          : 'Could not get your location. Showing Kuala Lumpur.',
      )
    })

    map.addControl(new ScaleControl(), 'bottom-left')

    map.on('style.load', () => {
      setupNavLayers(map)
      applyMapTheme(map, themeRef.current)
    })
    map.on('load', () => {
      callbacks.current.onMapReady?.(map)
      if ('geolocation' in navigator) geolocate.trigger()
      else callbacks.current.onLocationError?.('This browser has no GPS support. Showing Kuala Lumpur.')
    })

    return () => {
      mapRef.current = null
      map.remove()
    }
  }, [])

  // Re-theme in place when the toggle changes
  useEffect(() => {
    const map = mapRef.current
    if (map?.isStyleLoaded()) applyMapTheme(map, theme)
  }, [theme])

  return <div ref={containerRef} className={`map map--${theme}`} />
}

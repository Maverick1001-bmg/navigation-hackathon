import { useEffect, useRef } from 'react'
import {
  Map as MapLibreMap,
  NavigationControl,
  GeolocateControl,
  ScaleControl,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { applyMapTheme, setupNavLayers, type MapTheme } from './mapTheme'

// Free OpenStreetMap vector tiles, no API key. Recoloured light/dark by mapTheme.ts.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

// Kuala Lumpur
const START_CENTER: [number, number] = [101.6869, 3.139] // [lng, lat]
const START_ZOOM = 11

type Props = {
  theme: MapTheme
  onMapReady?: (map: MapLibreMap) => void
}

export default function MapView({ theme, onMapReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const themeRef = useRef(theme)
  themeRef.current = theme

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
    map.addControl(
      new GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      'top-right',
    )
    map.addControl(new ScaleControl(), 'bottom-left')

    map.on('style.load', () => {
      setupNavLayers(map)
      applyMapTheme(map, themeRef.current)
    })
    map.on('load', () => onMapReady?.(map))

    return () => {
      mapRef.current = null
      map.remove()
    }
  }, [onMapReady])

  // Re-theme in place when the toggle changes
  useEffect(() => {
    const map = mapRef.current
    if (map?.isStyleLoaded()) applyMapTheme(map, theme)
  }, [theme])

  return <div ref={containerRef} className={`map map--${theme}`} />
}

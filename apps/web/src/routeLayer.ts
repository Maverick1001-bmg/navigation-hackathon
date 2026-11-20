import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { LatLng } from './api'

// The route line: blue with a darker casing, drawn under search dots and pins.

const SOURCE = 'route'
const CASING = 'route-casing'
const LINE = 'route-line'
export const ROUTE_COLOUR = '#2b7bff' // blue is reserved for the route

export function addRouteLayer(map: MapLibreMap, beforeLayerId?: string) {
  const before = beforeLayerId && map.getLayer(beforeLayerId) ? beforeLayerId : undefined
  map.addSource(SOURCE, { type: 'geojson', data: line([]) })
  map.addLayer(
    {
      id: CASING,
      type: 'line',
      source: SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#0b3d91',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 6, 16, 13],
      },
    },
    before,
  )
  map.addLayer(
    {
      id: LINE,
      type: 'line',
      source: SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ROUTE_COLOUR,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 9],
      },
    },
    before,
  )

  return {
    setRoute(points: LatLng[] | null) {
      ;(map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(line(points ?? []))
    },
    remove() {
      for (const id of [LINE, CASING]) if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource(SOURCE)) map.removeSource(SOURCE)
    },
  }
}

export type RouteLayer = ReturnType<typeof addRouteLayer>

const line = (points: LatLng[]) => ({
  type: 'Feature' as const,
  properties: {},
  geometry: { type: 'LineString' as const, coordinates: points.map(p => [p.lng, p.lat]) },
})

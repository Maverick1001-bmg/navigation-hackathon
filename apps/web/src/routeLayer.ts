import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { LatLng } from './api'

// The route line: blue with a darker casing, drawn under search dots and pins.

const SOURCE = 'route'
const CASING = 'route-casing'
const LINE = 'route-line'
const DONE_SOURCE = 'route-done'
const DONE = 'route-done-line'
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

  // The part already driven, greyed out, on top of the route line
  map.addSource(DONE_SOURCE, { type: 'geojson', data: line([]) })
  map.addLayer(
    {
      id: DONE,
      type: 'line',
      source: DONE_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#9aa1ad',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 9],
      },
    },
    before,
  )

  return {
    setDone(points: LatLng[] | null) {
      ;(map.getSource(DONE_SOURCE) as GeoJSONSource | undefined)?.setData(line(points ?? []))
    },
    setRoute(points: LatLng[] | null) {
      ;(map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(line(points ?? []))
    },
    remove() {
      for (const id of [DONE, LINE, CASING]) if (map.getLayer(id)) map.removeLayer(id)
      for (const id of [DONE_SOURCE, SOURCE]) if (map.getSource(id)) map.removeSource(id)
    },
  }
}

export type RouteLayer = ReturnType<typeof addRouteLayer>

const line = (points: LatLng[]) => ({
  type: 'Feature' as const,
  properties: {},
  geometry: { type: 'LineString' as const, coordinates: points.map(p => [p.lng, p.lat]) },
})

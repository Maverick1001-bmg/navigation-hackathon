import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl'
import { setRailMuted } from '../mapTheme'
import type { TransitData } from './types'

// Rapid KL stations and the Google-Maps-style line highlight.
// Default: the base map's grey rail tracks + small white station dots (zoom 12+).
// Highlighted line: thick line in its official colour, white stops ringed in that colour with
// names, every other track and dot muted.

const LINE_SOURCE = 'transit-line'
const STATION_SOURCE = 'transit-stations'
const LINE_CASING = 'transit-line-casing'
const LINE = 'transit-line'
const DOTS = 'transit-dots' // stations not on the highlighted line (or all, when none is)
const LINE_STOPS = 'transit-line-stops'
const SELECTED = 'transit-selected'
const LABELS = 'transit-labels'
const CLICKABLE = [DOTS, LINE_STOPS, SELECTED]
const SEARCH_DOTS = 'search-results-dots' // searchLayer.ts; a click there wins
const NEUTRAL_RING = '#6b7280'

export type TransitLayer = {
  setHighlight(lineId: string | null, dir: 0 | 1): void
  setSelectedStation(stationId: string | null): void
  remove(): void
}

export function addTransitLayer(
  map: MapLibreMap,
  data: TransitData,
  onStationClick: (stationId: string) => void,
): TransitLayer {
  const interchange = new Set(data.stations.filter(s => s.lineIds.length > 1).map(s => s.id))
  let highlight: { lineId: string; dir: 0 | 1 } | null = null
  let selectedId: string | null = null

  // Lines sit under the base map's labels (and so under the driving route); dots under search dots.
  const firstSymbol = map.getStyle().layers?.find(l => l.type === 'symbol')?.id
  const dotsBefore = map.getLayer(SEARCH_DOTS) ? SEARCH_DOTS : undefined

  map.addSource(LINE_SOURCE, { type: 'geojson', data: empty() })
  map.addSource(STATION_SOURCE, { type: 'geojson', data: empty() })

  map.addLayer({
    id: LINE_CASING, type: 'line', source: LINE_SOURCE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 5, 15, 12] },
  }, firstSymbol)
  map.addLayer({
    id: LINE, type: 'line', source: LINE_SOURCE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'colour'], 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 3, 15, 8] },
  }, firstSymbol)
  map.addLayer({
    id: DOTS, type: 'circle', source: STATION_SOURCE, minzoom: 12,
    filter: ['!', ['get', 'onLine']],
    paint: {
      'circle-color': '#ffffff',
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, ['case', ['get', 'interchange'], 4.5, 3.5], 16, ['case', ['get', 'interchange'], 7, 5.5]],
      'circle-stroke-color': NEUTRAL_RING,
      'circle-stroke-width': 1.5,
      'circle-opacity': ['case', ['get', 'dim'], 0.35, 1],
      'circle-stroke-opacity': ['case', ['get', 'dim'], 0.35, 1],
    },
  }, dotsBefore)
  map.addLayer({
    id: LINE_STOPS, type: 'circle', source: STATION_SOURCE, minzoom: 9,
    filter: ['get', 'onLine'],
    paint: {
      'circle-color': '#ffffff',
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, ['case', ['get', 'interchange'], 4, 3], 15, ['case', ['get', 'interchange'], 8, 6.5]],
      'circle-stroke-color': ['get', 'colour'],
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 9, 1.5, 15, 3],
    },
  }, dotsBefore)
  map.addLayer({
    id: SELECTED, type: 'circle', source: STATION_SOURCE,
    filter: ['get', 'selected'],
    paint: {
      'circle-color': '#ffffff',
      'circle-radius': 9,
      'circle-stroke-color': ['get', 'colour'],
      'circle-stroke-width': 4,
    },
  }, dotsBefore)
  map.addLayer({
    id: LABELS, type: 'symbol', source: STATION_SOURCE, minzoom: 11,
    filter: ['get', 'onLine'],
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
      'text-anchor': 'left',
      'text-offset': [0.9, 0],
      'text-optional': true,
    },
    paint: { 'text-color': '#1f2328', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 },
  }, dotsBefore)

  const render = () => {
    const line = highlight ? data.lines.find(l => l.id === highlight!.lineId) : undefined
    const direction = line?.directions.find(d => d.dir === highlight!.dir) ?? line?.directions[0]
    const onLine = new Set(direction?.stops.map(s => s.stationId) ?? [])

    ;(map.getSource(LINE_SOURCE) as GeoJSONSource | undefined)?.setData(
      line && direction
        ? {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: direction.shape },
              properties: { colour: line.colour },
            }],
          }
        : empty(),
    )
    ;(map.getSource(STATION_SOURCE) as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: data.stations.map(s => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
        properties: {
          id: s.id,
          name: s.name,
          onLine: onLine.has(s.id),
          dim: !!line && !onLine.has(s.id),
          selected: s.id === selectedId,
          interchange: interchange.has(s.id),
          colour: line && onLine.has(s.id) ? line.colour : NEUTRAL_RING,
        },
      })),
    })
    setRailMuted(map, !!line)
  }

  const onClick = (e: MapLayerMouseEvent) => {
    if (map.getLayer(SEARCH_DOTS) && map.queryRenderedFeatures(e.point, { layers: [SEARCH_DOTS] }).length) return
    const id = e.features?.[0]?.properties?.id as string | undefined
    if (id) onStationClick(id)
  }
  const onEnter = () => (map.getCanvas().style.cursor = 'pointer')
  const onLeave = () => (map.getCanvas().style.cursor = '')
  for (const layer of CLICKABLE) {
    map.on('click', layer, onClick)
    map.on('mouseenter', layer, onEnter)
    map.on('mouseleave', layer, onLeave)
  }

  render()

  return {
    setHighlight(lineId, dir) {
      highlight = lineId ? { lineId, dir } : null
      render()
    },
    setSelectedStation(stationId) {
      if (stationId === selectedId) return
      selectedId = stationId
      render()
    },
    remove() {
      try {
        for (const layer of CLICKABLE) {
          map.off('click', layer, onClick)
          map.off('mouseenter', layer, onEnter)
          map.off('mouseleave', layer, onLeave)
        }
        for (const id of [LABELS, SELECTED, LINE_STOPS, DOTS, LINE, LINE_CASING]) {
          if (map.getLayer(id)) map.removeLayer(id)
        }
        for (const id of [LINE_SOURCE, STATION_SOURCE]) {
          if (map.getSource(id)) map.removeSource(id)
        }
        setRailMuted(map, false)
      } catch {
        // map already destroyed (MapView unmount); nothing to clean up
      }
    },
  }
}

const empty = () => ({ type: 'FeatureCollection' as const, features: [] })

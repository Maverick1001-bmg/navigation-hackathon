import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { Place } from './photon'

// Purple dots for every search result while the list is open.
// One GeoJSON layer (not one DOM marker per result) so 40 pins stay cheap.

const SOURCE = 'search-results'
const LAYER = 'search-results-dots'
const COLOUR = '#8b5cf6' // same as the selected-place pin; not blue (route) or red (incidents)

export function addSearchLayer(map: MapLibreMap, onPick: (place: Place) => void) {
  const byId = new Map<string, Place>()

  map.addSource(SOURCE, { type: 'geojson', data: empty() })
  map.addLayer({
    id: LAYER,
    type: 'circle',
    source: SOURCE,
    paint: {
      'circle-color': COLOUR,
      'circle-radius': ['case', ['get', 'active'], 9, 6],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': ['case', ['get', 'active'], 3, 2],
    },
  })

  const onClick = (e: { features?: { properties?: Record<string, unknown> }[] }) => {
    const id = e.features?.[0]?.properties?.id as string | undefined
    const place = id ? byId.get(id) : undefined
    if (place) onPick(place)
  }
  const onEnter = () => (map.getCanvas().style.cursor = 'pointer')
  const onLeave = () => (map.getCanvas().style.cursor = '')
  map.on('click', LAYER, onClick)
  map.on('mouseenter', LAYER, onEnter)
  map.on('mouseleave', LAYER, onLeave)

  let places: Place[] = []
  let activeId: string | null = null

  const render = () => {
    const source = map.getSource(SOURCE) as GeoJSONSource | undefined
    source?.setData({
      type: 'FeatureCollection',
      // Active dot drawn last so it sits on top
      features: [...places]
        .sort((a, b) => Number(a.id === activeId) - Number(b.id === activeId))
        .map(p => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
          properties: { id: p.id, active: p.id === activeId },
        })),
    })
  }

  return {
    setResults(next: Place[]) {
      places = next
      byId.clear()
      for (const p of next) byId.set(p.id, p)
      render()
    },
    setActive(id: string | null) {
      if (id === activeId) return
      activeId = id
      render()
    },
    remove() {
      map.off('click', LAYER, onClick)
      map.off('mouseenter', LAYER, onEnter)
      map.off('mouseleave', LAYER, onLeave)
      if (map.getLayer(LAYER)) map.removeLayer(LAYER)
      if (map.getSource(SOURCE)) map.removeSource(SOURCE)
    },
  }
}

export type SearchLayer = ReturnType<typeof addSearchLayer>

const empty = () => ({ type: 'FeatureCollection' as const, features: [] })

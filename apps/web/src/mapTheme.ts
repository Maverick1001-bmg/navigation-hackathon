import type { Map as MapLibreMap, FilterSpecification } from 'maplibre-gl'

// Navigation styling for the OpenFreeMap "liberty" style.
//   setupNavLayers(map)        – once per style load: what is shown / hidden / filtered
//   applyMapTheme(map, theme)  – colours, re-run on every light/dark switch (no reload)
// Only base-map layers are touched, so app layers (route, incidents) keep their own look.
// Colour rule: base map avoids blue (reserved for the route) and red (incidents).

// ───────────── Settings: tweak these ─────────────

/** POI classes to show (OpenMapTiles `class`). Everything else is hidden. */
export const NAV_POI_CLASSES = ['fuel', 'parking', 'hospital', 'police', 'fire_station']
/** Zoom at which minor street names appear (liberty default 15). */
const MINOR_STREET_NAMES_FROM_ZOOM = 14
/** Zoom at which top-rank POIs (fuel, hospitals...) appear (liberty default 15). */
const POIS_FROM_ZOOM = 14
const SHOW_3D_BUILDINGS = false
const SHOW_FOOTPATHS = false
const SHOW_RAIL_STATIONS = false // transit/transitLayer.ts draws Rapid KL stations instead

export type MapTheme = 'light' | 'dark'

type Palette = {
  bg: string; water: string; waterway: string; park: string; landcoverOpacity: number
  building: string; aeroway: string; rail: string; boundary: string
  motorway: string; motorwayCasing: string
  primary: string; primaryCasing: string     // trunk + primary
  secondary: string; secondaryCasing: string // secondary + tertiary
  minor: string; minorCasing: string         // streets, service, links
  label: string; labelHalo: string           // place / water / POI names
  roadLabel: string; roadLabelHalo: string   // street names
}

const PALETTES: Record<MapTheme, Palette> = {
  light: {
    bg: '#f3f2ee', water: '#b5d0d6', waterway: '#9cc2cc', park: '#d3e6c6', landcoverOpacity: 0.35,
    building: '#e0ddd6', aeroway: '#e6e3dc', rail: '#b4b1aa', boundary: '#a8a3b3',
    motorway: '#f6b54a', motorwayCasing: '#cf8a1f',
    primary: '#fde08f', primaryCasing: '#d6b45a',
    secondary: '#ffffff', secondaryCasing: '#c9c6bf',
    minor: '#ffffff', minorCasing: '#d6d3cc',
    label: '#3c4043', labelHalo: '#ffffff',
    roadLabel: '#4a4d52', roadLabelHalo: '#ffffff',
  },
  dark: {
    bg: '#181b21', water: '#0e2531', waterway: '#1a3c4c', park: '#1c2e22', landcoverOpacity: 0.25,
    building: '#252931', aeroway: '#22262d', rail: '#4a4f59', boundary: '#4d4a5c',
    motorway: '#c88a2e', motorwayCasing: '#0f1115',
    primary: '#7d6c3f', primaryCasing: '#0f1115',
    secondary: '#4b515d', secondaryCasing: '#0f1115',
    minor: '#363b45', minorCasing: '#0f1115',
    label: '#e3e5ea', labelHalo: '#181b21',
    roadLabel: '#c4c8d0', roadLabelHalo: '#181b21',
  },
}

// ───────────── Layer classification ─────────────

type Layer = { id: string; type: string; source?: string; 'source-layer'?: string }

const baseLayers = (map: MapLibreMap) =>
  ((map.getStyle().layers ?? []) as Layer[]).filter(
    l => l.id === 'background' || l.source === 'openmaptiles' || l.type === 'raster',
  )

type RoadTier = 'motorway' | 'primary' | 'secondary' | 'minor' | 'rail' | 'path'

function roadTier(id: string): RoadTier {
  if (id.includes('rail')) return 'rail'
  if (id.includes('path') || id.includes('pedestrian')) return 'path'
  if (id.includes('motorway')) return 'motorway'
  if (id.includes('trunk') || id.includes('primary')) return 'primary'
  if (id.includes('secondary') || id.includes('tertiary')) return 'secondary'
  return 'minor' // minor, street, service_track, link
}

const isPoiLayer = (id: string) => /^poi_r\d+$/.test(id)

const KEEP_SYMBOL = (l: Layer) => {
  const src = l['source-layer']
  if (src === 'place' || src === 'water_name' || src === 'aerodrome_label') return true
  if (l.id === 'waterway_line_label') return true
  if (l.id === 'highway-name-major' || l.id === 'highway-name-minor') return true
  if (l.id === 'highway-shield-non-us') return true // Malaysian E/FT route numbers
  if (l.id === 'road_one_way_arrow' || l.id === 'road_one_way_arrow_opposite') return true
  if (isPoiLayer(l.id)) return true
  if (l.id === 'poi_transit') return SHOW_RAIL_STATIONS
  if (l.id === 'highway-name-path') return SHOW_FOOTPATHS
  return false
}

/** Fade the base map's rail tracks while a transit line is highlighted (transit). */
export function setRailMuted(map: MapLibreMap, muted: boolean) {
  for (const l of baseLayers(map)) {
    if (l['source-layer'] === 'transportation' && l.type === 'line' && roadTier(l.id) === 'rail') {
      map.setPaintProperty(l.id, 'line-opacity', muted ? 0.25 : 1)
    }
  }
}

// ───────────── 1. What is shown (run once per style load) ─────────────

export function setupNavLayers(map: MapLibreMap) {
  for (const l of baseLayers(map)) {
    const show = (on: boolean) => map.setLayoutProperty(l.id, 'visibility', on ? 'visible' : 'none')

    if (l.type === 'symbol') {
      show(KEEP_SYMBOL(l))
      if (isPoiLayer(l.id)) {
        const original = map.getFilter(l.id)
        const onlyNav: FilterSpecification = ['match', ['get', 'class'], NAV_POI_CLASSES, true, false]
        map.setFilter(l.id, (original ? ['all', original, onlyNav] : onlyNav) as FilterSpecification)
        if (l.id === 'poi_r1') map.setLayerZoomRange(l.id, POIS_FROM_ZOOM, 24)
      }
      if (l.id === 'poi_transit') {
        // KL's LRT/MRT/monorail/KTM stops are class 'railway' (subclass station|subway)
        map.setFilter(l.id, ['all',
          ['==', ['get', 'class'], 'railway'],
          ['match', ['get', 'subclass'], ['station', 'subway'], true, false],
        ])
      }
      if (l.id === 'highway-name-minor') map.setLayerZoomRange(l.id, MINOR_STREET_NAMES_FROM_ZOOM, 24)
      continue
    }

    if (l.type === 'raster') show(false) // low-zoom hillshade clashes with flat colours
    if (l.type === 'fill-extrusion') show(SHOW_3D_BUILDINGS)
    if (l['source-layer'] === 'transportation') {
      if (l.type === 'fill') show(false) // paved-area pattern
      if (l.type === 'line' && roadTier(l.id) === 'path') show(SHOW_FOOTPATHS)
    }
  }
}

// ───────────── 2. Colours (run on every theme switch) ─────────────

export function applyMapTheme(map: MapLibreMap, theme: MapTheme) {
  const c = PALETTES[theme]
  type PaintArgs = Parameters<MapLibreMap['setPaintProperty']>
  const paint = (id: string, prop: string, value: string | number) =>
    map.setPaintProperty(id, prop as PaintArgs[1], value as PaintArgs[2])

  for (const l of baseLayers(map)) {
    const { id, type } = l
    const src = l['source-layer']

    if (id === 'background') { paint(id, 'background-color', c.bg); continue }

    if (type === 'symbol') {
      if (map.getLayoutProperty(id, 'visibility') === 'none') continue
      const isRoadName = id.startsWith('highway-name')
      if (id.startsWith('highway-shield') || id.startsWith('road_one_way')) continue // keep sprite look
      paint(id, 'text-color', isRoadName ? c.roadLabel : c.label)
      paint(id, 'text-halo-color', isRoadName ? c.roadLabelHalo : c.labelHalo)
      paint(id, 'text-halo-width', 1.4)
      if (id === 'poi_transit') {
        map.setLayoutProperty(id, 'icon-image', stationIcon(map, theme, c.label, c.labelHalo))
      }
      continue
    }

    if (src === 'water' && type === 'fill') { paint(id, 'fill-color', c.water); continue }
    if (src === 'waterway' && type === 'line') { paint(id, 'line-color', c.waterway); continue }
    if (src === 'park') {
      if (type === 'fill') paint(id, 'fill-color', c.park)
      else if (type === 'line') paint(id, 'line-color', c.park)
      continue
    }
    if ((src === 'landcover' || src === 'landuse') && type === 'fill') {
      paint(id, 'fill-opacity', c.landcoverOpacity)
      continue
    }
    if (src === 'boundary' && type === 'line') { paint(id, 'line-color', c.boundary); continue }
    if (src === 'aeroway') {
      if (type === 'fill') paint(id, 'fill-color', c.aeroway)
      else if (type === 'line') paint(id, 'line-color', c.minor)
      continue
    }
    if (src === 'building') {
      if (type === 'fill') {
        paint(id, 'fill-color', c.building)
        paint(id, 'fill-outline-color', c.building)
      } else if (type === 'fill-extrusion') {
        paint(id, 'fill-extrusion-color', c.building)
      }
      continue
    }

    if (src === 'transportation' && type === 'line') {
      const tier = roadTier(id)
      if (tier === 'rail') { paint(id, 'line-color', c.rail); continue }
      if (tier === 'path') { paint(id, 'line-color', c.minorCasing); continue }
      const casing = id.includes('casing')
      const colours = {
        motorway: [c.motorway, c.motorwayCasing],
        primary: [c.primary, c.primaryCasing],
        secondary: [c.secondary, c.secondaryCasing],
        minor: [c.minor, c.minorCasing],
      }[tier]
      paint(id, 'line-color', casing ? colours[1] : colours[0])
      // Tunnels read as "underneath": slightly faded
      paint(id, 'line-opacity', id.startsWith('tunnel') ? 0.6 : 1)
    }
  }
}

// Clean haloed dot for rail/MRT/LRT stations, replacing liberty's busy sprite.
function stationIcon(map: MapLibreMap, theme: MapTheme, label: string, halo: string): string {
  const key = `station-${theme}`
  if (map.hasImage(key)) return key
  const s = 24, m = s / 2
  const cv = document.createElement('canvas')
  cv.width = s; cv.height = s
  const ctx = cv.getContext('2d')
  if (!ctx) return key
  ctx.beginPath(); ctx.arc(m, m, 8, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill()
  ctx.beginPath(); ctx.arc(m, m, 5.5, 0, Math.PI * 2); ctx.fillStyle = label; ctx.fill()
  try { map.addImage(key, ctx.getImageData(0, 0, s, s), { pixelRatio: 2 }) } catch { /* raced */ }
  return key
}

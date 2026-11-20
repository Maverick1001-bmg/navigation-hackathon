// Place search via Photon (OpenStreetMap geocoder, free, no API key).
// Public instance is fair-use: debounce input, don't fire on every keystroke.
//
// Results are returned as entries: either a single place, or a group of branches of
// the same chain (same name + same category, e.g. 20 × "McDonald's" fast food).
// Groups are sorted nearest-first. Public places (food, shops, fuel, attractions,
// transport) rank above offices/companies with a similar name.

export type Place = {
  id: string
  name: string
  detail: string // street, area, city
  category: string // e.g. "Fast food"
  lng: number
  lat: number
  distanceM: number // from the search bias point (map centre / GPS)
  bbox?: [number, number, number, number] // [minLng, minLat, maxLng, maxLat]
}

export type SearchEntry =
  | { kind: 'place'; place: Place }
  | { kind: 'group'; key: string; name: string; category: string; places: Place[] }

const PHOTON_URL = 'https://photon.komoot.io/api/'
const MALAYSIA_BBOX = '99.6,0.8,119.3,7.5' // Peninsular + Sabah/Sarawak
const FETCH_LIMIT = 40 // enough to see many branches of a chain
const MAX_ENTRIES = 6

// OSM tag keys for places people actually go to. Anything else (office, craft,
// building, landuse...) is ranked after these.
const PUBLIC_PLACE_KEYS = new Set([
  'amenity', 'shop', 'tourism', 'leisure', 'railway', 'public_transport', 'aeroway',
  'place', 'highway', 'historic', 'natural', 'healthcare', 'sport',
])

type PhotonProps = {
  osm_type?: string; osm_id?: number; osm_key?: string; osm_value?: string
  name?: string; housenumber?: string; street?: string
  locality?: string; district?: string; city?: string; state?: string
  extent?: [number, number, number, number] // [minLng, maxLat, maxLng, minLat]
}
type PhotonFeature = { geometry: { coordinates: [number, number] }; properties: PhotonProps }

type Ranked = { place: Place; osmKey: string; groupKey: string; order: number }

// Photon is the main geocoder. If it's slow or down, fall back to Nominatim (also OSM).
// After a Photon failure we skip it for a minute so typing doesn't wait on timeouts.
const PHOTON_TIMEOUT_MS = 4000
const PHOTON_RETRY_AFTER_MS = 60_000
let photonDownUntil = 0

export async function searchPlaces(
  query: string,
  near: { lng: number; lat: number },
  signal: AbortSignal,
): Promise<SearchEntry[]> {
  let features: PhotonFeature[]
  if (Date.now() < photonDownUntil) {
    features = await fetchNominatim(query, near, signal)
  } else {
    try {
      features = await fetchPhoton(query, near, signal)
    } catch (err) {
      if (signal.aborted) throw err // user kept typing: not a Photon failure
      photonDownUntil = Date.now() + PHOTON_RETRY_AFTER_MS
      features = await fetchNominatim(query, near, signal)
    }
  }
  return rank(features, near)
}

async function fetchPhoton(query: string, near: { lng: number; lat: number }, signal: AbortSignal) {
  const params = new URLSearchParams({
    q: query,
    limit: String(FETCH_LIMIT),
    lang: 'en',
    lat: near.lat.toFixed(4),
    lon: near.lng.toFixed(4),
    bbox: MALAYSIA_BBOX,
  })
  const res = await fetchWithTimeout(`${PHOTON_URL}?${params}`, signal, PHOTON_TIMEOUT_MS)
  if (!res.ok) throw new Error(`Photon ${res.status}`)
  return ((await res.json()) as { features: PhotonFeature[] }).features
}

// Nominatim fallback, converted to Photon's shape so ranking/grouping stays the same.
// Fair use: max ~1 request/second. Only used when Photon is failing.
type NominatimItem = {
  osm_type?: string; osm_id?: number; category?: string; type?: string
  lat: string; lon: string; name?: string
  address?: Record<string, string>
  boundingbox?: [string, string, string, string] // [minLat, maxLat, minLng, maxLng]
}

async function fetchNominatim(query: string, near: { lng: number; lat: number }, signal: AbortSignal) {
  const d = 0.5 // ~55 km bias box around the map centre (not a hard limit)
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '40',
    countrycodes: 'my',
    'accept-language': 'en',
    viewbox: `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`,
  })
  const res = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?${params}`, signal, 8000)
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  const items = (await res.json()) as NominatimItem[]
  return items.map((n): PhotonFeature => {
    const a = n.address ?? {}
    const b = n.boundingbox?.map(Number)
    return {
      geometry: { coordinates: [Number(n.lon), Number(n.lat)] },
      properties: {
        osm_type: n.osm_type?.[0]?.toUpperCase(),
        osm_id: n.osm_id,
        osm_key: n.category,
        osm_value: n.type,
        name: n.name || undefined,
        housenumber: a.house_number,
        street: a.road,
        locality: a.quarter || a.neighbourhood,
        district: a.suburb,
        city: a.city || a.town || a.village,
        state: a.state,
        extent: b && b.length === 4 && (b[1] - b[0] > 0.002 || b[3] - b[2] > 0.002)
          ? [b[2], b[1], b[3], b[0]] // → [minLng, maxLat, maxLng, minLat]
          : undefined,
      },
    }
  })
}

// fetch that gives up after `ms`, while still honouring the caller's abort.
async function fetchWithTimeout(url: string, outer: AbortSignal, ms: number) {
  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  outer.addEventListener('abort', onAbort)
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
    outer.removeEventListener('abort', onAbort)
  }
}

function rank(features: PhotonFeature[], near: { lng: number; lat: number }): SearchEntry[] {
  // 1. Convert + drop duplicates (OSM often has two nodes for one place)
  const seen = new Set<string>()
  const ranked: Ranked[] = []
  features.forEach((f, order) => {
    const place = toPlace(f, near)
    const dupKey = `${place.name}|${place.lng.toFixed(3)}|${place.lat.toFixed(3)}`
    if (seen.has(dupKey)) return
    seen.add(dupKey)
    const p = f.properties
    const category = `${p.osm_key ?? ''}=${p.osm_value ?? ''}`
    ranked.push({ place, osmKey: p.osm_key ?? '', groupKey: `${normalise(place.name)}|${category}`, order })
  })

  // 2. Group by name + category, keeping Photon's relevance order for the group
  const groups = new Map<string, Ranked[]>()
  for (const r of ranked) {
    const g = groups.get(r.groupKey)
    if (g) g.push(r)
    else groups.set(r.groupKey, [r])
  }

  // 3. Rank: public places first, then Photon's order (first appearance)
  const tier = (osmKey: string) => (PUBLIC_PLACE_KEYS.has(osmKey) ? 0 : 1)
  const sorted = [...groups.entries()].sort(
    ([, a], [, b]) => tier(a[0].osmKey) - tier(b[0].osmKey) || a[0].order - b[0].order,
  )

  return sorted.slice(0, MAX_ENTRIES).map(([key, members]): SearchEntry => {
    if (members.length === 1) return { kind: 'place', place: members[0].place }
    const places = members.map(m => m.place).sort((a, b) => a.distanceM - b.distanceM)
    return { kind: 'group', key, name: places[0].name, category: places[0].category, places }
  })
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`
  if (m < 10_000) return `${(m / 1000).toFixed(1)} km`
  return `${Math.round(m / 1000)} km`
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

const prettyCategory = (osmValue?: string) =>
  osmValue && osmValue !== 'yes'
    ? osmValue.charAt(0).toUpperCase() + osmValue.slice(1).replace(/_/g, ' ')
    : ''

function toPlace(f: PhotonFeature, near: { lng: number; lat: number }): Place {
  const p = f.properties
  const [lng, lat] = f.geometry.coordinates
  const streetLine = [p.housenumber, p.street].filter(Boolean).join(' ')
  const name = p.name || streetLine || p.district || p.city || 'Unnamed place'
  const detailParts = [p.name ? streetLine : '', p.locality, p.district, p.city, p.state]
    .filter((s): s is string => !!s && s !== name)
  const e = p.extent
  return {
    id: `${p.osm_type ?? ''}${p.osm_id ?? `${lng},${lat}`}`,
    name,
    detail: [...new Set(detailParts)].join(', '),
    category: prettyCategory(p.osm_value),
    lng,
    lat,
    distanceM: haversineM(near.lat, near.lng, lat, lng),
    bbox: e ? [e[0], e[3], e[2], e[1]] : undefined,
  }
}

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

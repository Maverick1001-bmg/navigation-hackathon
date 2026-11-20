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

export async function searchPlaces(
  query: string,
  near: { lng: number; lat: number },
  signal: AbortSignal,
): Promise<SearchEntry[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(FETCH_LIMIT),
    lang: 'en',
    lat: near.lat.toFixed(4),
    lon: near.lng.toFixed(4),
    bbox: MALAYSIA_BBOX,
  })
  const res = await fetch(`${PHOTON_URL}?${params}`, { signal })
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  const data = (await res.json()) as { features: PhotonFeature[] }

  // 1. Convert + drop duplicates (OSM often has two nodes for one place)
  const seen = new Set<string>()
  const ranked: Ranked[] = []
  data.features.forEach((f, order) => {
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

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

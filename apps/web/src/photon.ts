// Place search via Photon (OpenStreetMap geocoder, free, no API key).
// Public instance is fair-use: debounce input, don't fire on every keystroke.

export type Place = {
  id: string
  name: string
  detail: string // street, area, city
  lng: number
  lat: number
  bbox?: [number, number, number, number] // [minLng, minLat, maxLng, maxLat]
}

const PHOTON_URL = 'https://photon.komoot.io/api/'
const MALAYSIA_BBOX = '99.6,0.8,119.3,7.5' // Peninsular + Sabah/Sarawak

type PhotonProps = {
  osm_type?: string; osm_id?: number
  name?: string; housenumber?: string; street?: string
  locality?: string; district?: string; city?: string; state?: string
  extent?: [number, number, number, number] // [minLng, maxLat, maxLng, minLat]
}
type PhotonFeature = { geometry: { coordinates: [number, number] }; properties: PhotonProps }

export async function searchPlaces(
  query: string,
  near: { lng: number; lat: number },
  signal: AbortSignal,
): Promise<Place[]> {
  const params = new URLSearchParams({
    q: query,
    limit: '8',
    lang: 'en',
    lat: near.lat.toFixed(4),
    lon: near.lng.toFixed(4),
    bbox: MALAYSIA_BBOX,
  })
  const res = await fetch(`${PHOTON_URL}?${params}`, { signal })
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  const data = (await res.json()) as { features: PhotonFeature[] }

  // Photon often returns the same place twice (e.g. two nodes for one station)
  const seen = new Set<string>()
  const places: Place[] = []
  for (const f of data.features) {
    const place = toPlace(f)
    const key = `${place.name}|${place.lng.toFixed(3)}|${place.lat.toFixed(3)}`
    if (seen.has(key)) continue
    seen.add(key)
    places.push(place)
  }
  return places.slice(0, 6)
}

function toPlace(f: PhotonFeature): Place {
  const p = f.properties
  const [lng, lat] = f.geometry.coordinates
  const streetLine = [p.housenumber, p.street].filter(Boolean).join(' ')
  const name = p.name || streetLine || p.district || p.city || 'Unnamed place'
  const detailParts = [p.name ? streetLine : '', p.locality, p.district, p.city, p.state]
    .filter((s): s is string => !!s && s !== name)
  const detail = [...new Set(detailParts)].join(', ')
  const e = p.extent
  return {
    id: `${p.osm_type ?? ''}${p.osm_id ?? `${lng},${lat}`}`,
    name,
    detail,
    lng,
    lat,
    bbox: e ? [e[0], e[3], e[2], e[1]] : undefined,
  }
}

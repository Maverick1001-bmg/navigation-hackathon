import type { Direction, Line, Station, TransitData } from './types.ts'

const SEARCH_MATCH_M = 150
const STATION_CATEGORY = /station|halt|subway|monorail|platform|stop/i

export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = Math.PI / 180
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(a))
}

export function nearestStation(data: TransitData, lng: number, lat: number, maxM: number): Station | null {
  let best: Station | null = null
  let bestD = maxM
  for (const s of data.stations) {
    const d = distanceM(lat, lng, s.lat, s.lng)
    if (d <= bestD) { best = s; bestD = d }
  }
  return best
}

const normalise = (name: string) =>
  name.toLowerCase().replace(/\b(lrt|mrt|brt|monorail|station|stesen)\b/g, '').replace(/[^a-z0-9]/g, '')

/** The station a search result refers to, if it is one of ours (close by and looks like a station). */
export function stationForPlace(
  data: TransitData,
  place: { name: string; category: string; lng: number; lat: number },
): Station | null {
  const s = nearestStation(data, place.lng, place.lat, SEARCH_MATCH_M)
  if (!s) return null
  const stationName = normalise(s.name)
  const nameMatches = stationName !== '' && normalise(place.name).includes(stationName)
  return STATION_CATEGORY.test(place.category) || nameMatches ? s : null
}

export function stopIndex(d: Direction, stationId: string): number {
  return d.stops.findIndex(s => s.stationId === stationId)
}

/** The direction with more stops ahead of this station (toward the farther terminus); tie → 0. */
export function defaultDir(line: Line, stationId: string): 0 | 1 {
  const ahead = (d: Direction) => {
    const i = stopIndex(d, stationId)
    return i < 0 ? -1 : d.stops.length - 1 - i
  }
  const d0 = line.directions.find(d => d.dir === 0)
  const d1 = line.directions.find(d => d.dir === 1)
  return d1 && (!d0 || ahead(d1) > ahead(d0)) ? 1 : 0
}

export function linesAt(data: TransitData, stationId: string): Line[] {
  const station = data.stations.find(s => s.id === stationId)
  if (!station) return []
  return data.lines.filter(l => station.lineIds.includes(l.id))
}

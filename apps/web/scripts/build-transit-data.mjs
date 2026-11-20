// Converts the Rapid KL rail GTFS feed (data.gov.my) into src/transit/rapidRail.json.
// Run by hand when the feed changes; the JSON output is committed.
//
//   curl -sL "https://api.data.gov.my/gtfs-static/prasarana?category=rapid-rail-kl" -o rail.zip && tar -xf rail.zip
//   node scripts/build-transit-data.mjs <unzipped-gtfs-dir> src/transit/rapidRail.json

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Stop ids that should be one station even if further apart than the merge radius. */
const MERGE_OVERRIDES = [['KJ9', 'PY20']] // Ampang Park (KJ) + Ampang Park (PYL), ~290 m, linked walkway
/** Stop ids that must stay separate stations even though they are close together. */
const KEEP_APART = [['AG8', 'KG17'], ['SP8', 'KG17']] // Plaza Rakyat (LRT) vs Merdeka (MRT): different names people search for
/** Station id → display name, for names cleanName gets wrong. */
const NAME_OVERRIDES = { KJ31: 'USJ 7', SP22: 'Kinrara BK5', SA14: 'UiTM Shah Alam' }
const ACRONYMS = new Set(['KL', 'KLCC', 'PWTC', 'USJ', 'IOI', 'UIA', 'TTDI', 'KPJ', 'SS', 'UPM', 'LRT', 'MRT', 'BRT', 'PPR'])
const MERGE_RADIUS_M = 250
const SERVICES = ['MonFri', 'Sat', 'Sun']

export function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim() !== '')
  const split = line => {
    const out = []
    let cur = ''
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
        else if (ch === '"') quoted = false
        else cur += ch
      } else if (ch === '"') quoted = true
      else if (ch === ',') { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur)
    return out
  }
  const header = split(lines[0]).map(h => h.trim())
  return lines.slice(1).map(line => {
    const cells = split(line)
    return Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? '').trim()]))
  })
}

export function parseTime(hms) {
  const [h, m, s] = hms.split(':').map(Number)
  return h * 3600 + m * 60 + s
}

export function cleanName(raw) {
  const base = raw.split(' - ')[0].trim()
  if (base !== base.toUpperCase()) return base
  return base
    .split(/([\s\-/]+)/)
    .map(part => {
      if (/^[\s\-/]+$/.test(part) || part === '') return part
      if (ACRONYMS.has(part)) return part
      return part[0] + part.slice(1).toLowerCase()
    })
    .join('')
}

export function distanceM(lat1, lng1, lat2, lng2) {
  const r = Math.PI / 180
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(a))
}

export function groupStops(stops, maxM, mergeOverrides, keepApart = []) {
  const parent = stops.map((_, i) => i)
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const union = (i, j) => { parent[find(j)] = find(i) }
  const apart = new Set(keepApart.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]))
  const idx = new Map(stops.map((s, i) => [s.stop_id, i]))

  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) {
      if (apart.has(`${stops[i].stop_id}|${stops[j].stop_id}`)) continue
      const d = distanceM(+stops[i].stop_lat, +stops[i].stop_lon, +stops[j].stop_lat, +stops[j].stop_lon)
      if (d <= maxM) union(i, j)
    }
  }
  for (const ids of mergeOverrides) {
    for (const id of ids.slice(1)) union(idx.get(ids[0]), idx.get(id))
  }

  const groups = new Map()
  stops.forEach((s, i) => {
    const root = find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(s)
  })
  return [...groups.values()].map(members => ({
    stopIds: members.map(m => m.stop_id),
    lng: members.reduce((t, m) => t + +m.stop_lon, 0) / members.length,
    lat: members.reduce((t, m) => t + +m.stop_lat, 0) / members.length,
    rawNames: members.map(m => m.stop_name),
  }))
}

const round5 = n => Math.round(n * 1e5) / 1e5

function main(gtfsDir, outFile) {
  const read = name => parseCsv(readFileSync(join(gtfsDir, name), 'utf8'))
  const routes = read('routes.txt')
  const trips = read('trips.txt')
  const stopTimes = read('stop_times.txt')
  const frequencies = read('frequencies.txt')
  const shapes = read('shapes.txt')
  const stops = read('stops.txt')

  const groups = groupStops(stops, MERGE_RADIUS_M, MERGE_OVERRIDES, KEEP_APART)
  const stationOfStop = new Map()
  const stations = groups.map(g => {
    const id = g.stopIds[0]
    for (const s of g.stopIds) stationOfStop.set(s, id)
    const shortest = [...g.rawNames].sort((a, b) => a.length - b.length)[0]
    return {
      id,
      name: NAME_OVERRIDES[id] ?? cleanName(shortest),
      lng: round5(g.lng),
      lat: round5(g.lat),
      lineIds: [],
      stopIds: g.stopIds,
    }
  })
  const stationById = new Map(stations.map(s => [s.id, s]))

  const timesByTrip = new Map()
  for (const st of stopTimes) {
    if (!timesByTrip.has(st.trip_id)) timesByTrip.set(st.trip_id, [])
    timesByTrip.get(st.trip_id).push(st)
  }
  const freqByTrip = new Map()
  for (const f of frequencies) {
    if (!freqByTrip.has(f.trip_id)) freqByTrip.set(f.trip_id, [])
    freqByTrip.get(f.trip_id).push({ from: parseTime(f.start_time), to: parseTime(f.end_time), headwayS: +f.headway_secs })
  }
  const shapeById = new Map()
  for (const p of shapes) {
    if (!shapeById.has(p.shape_id)) shapeById.set(p.shape_id, [])
    shapeById.get(p.shape_id).push(p)
  }

  const lines = routes.map(r => {
    const directions = [0, 1].map(dir => {
      const tripFor = svc =>
        trips.find(t => t.route_id === r.route_id && t.service_id === svc && +t.direction_id === dir)
      const base = tripFor('MonFri')
      if (!base) throw new Error(`No MonFri trip for ${r.route_id} dir ${dir}`)

      const times = [...(timesByTrip.get(base.trip_id) ?? [])].sort((a, b) => +a.stop_sequence - +b.stop_sequence)
      const t0 = parseTime(times[0].arrival_time)
      const dirStops = times.map(t => {
        const stationId = stationOfStop.get(t.stop_id)
        if (!stationId) throw new Error(`Unknown stop ${t.stop_id} on ${base.trip_id}`)
        return { stationId, offsetS: parseTime(t.arrival_time) - t0 }
      })

      const service = {}
      for (const svc of SERVICES) {
        const trip = tripFor(svc) ?? base
        if (trip === base && svc !== 'MonFri') console.warn(`  ${r.route_id} dir ${dir}: no ${svc} trip, using MonFri`)
        const periods = [...(freqByTrip.get(trip.trip_id) ?? [])].sort((a, b) => a.from - b.from)
        service[svc] = { periods }
      }

      const shape = [...(shapeById.get(base.shape_id) ?? [])]
        .sort((a, b) => +a.shape_pt_sequence - +b.shape_pt_sequence)
        .map(p => [round5(+p.shape_pt_lon), round5(+p.shape_pt_lat)])

      const last = stationById.get(dirStops[dirStops.length - 1].stationId)
      return { dir, headsign: last.name, shape, stops: dirStops, service }
    })

    for (const d of directions) {
      for (const s of d.stops) {
        const st = stationById.get(s.stationId)
        if (!st.lineIds.includes(r.route_id)) st.lineIds.push(r.route_id)
      }
    }

    return {
      id: r.route_id,
      shortName: r.route_short_name,
      name: r.route_long_name,
      colour: `#${r.route_color.toUpperCase()}`,
      directions,
    }
  })

  const served = stations.filter(s => s.lineIds.length > 0)
  const unserved = stations.length - served.length
  const interchanges = served.filter(s => s.stopIds.length > 1)

  writeFileSync(outFile, JSON.stringify({ lines, stations: served }))
  console.log(`${lines.length} lines, ${served.length} stations, ${interchanges.length} interchanges` +
    (unserved ? ` (${unserved} stations with no trips dropped)` : ''))
  for (const s of interchanges) {
    const names = s.stopIds.map(id => stops.find(x => x.stop_id === id).stop_name).join(' / ')
    console.log(`  ${s.id} "${s.name}": ${names}`)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [gtfsDir, outFile] = process.argv.slice(2)
  if (!gtfsDir || !outFile) {
    console.error('usage: node scripts/build-transit-data.mjs <gtfs-dir> <out.json>')
    process.exit(1)
  }
  main(gtfsDir, outFile)
}

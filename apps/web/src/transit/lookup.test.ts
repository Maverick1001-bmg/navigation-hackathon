import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stationForPlace, defaultDir, stopIndex, linesAt, nearestStation } from './lookup.ts'
import type { Line, ServiceSchedule, Station, TransitData } from './types.ts'

const svc: ServiceSchedule = { periods: [{ from: 21600, to: 86400, headwayS: 300 }] }
const service = { MonFri: svc, Sat: svc, Sun: svc }
const station = (id: string, name: string, lat: number, lng: number, lineIds: string[]): Station =>
  ({ id, name, lat, lng, lineIds, stopIds: [id] })
const line = (id: string, ids: string[]): Line => ({
  id, shortName: id, name: `${id} Line`, colour: '#123456',
  directions: [
    { dir: 0, headsign: ids[ids.length - 1], shape: [], service, stops: ids.map((s, i) => ({ stationId: s, offsetS: i * 120 })) },
    { dir: 1, headsign: ids[0], shape: [], service, stops: [...ids].reverse().map((s, i) => ({ stationId: s, offsetS: i * 120 })) },
  ],
})

// Masjid Jamek at 3.1493, 101.6964; others well apart
const data: TransitData = {
  lines: [line('L1', ['A', 'X', 'B']), line('L2', ['C', 'X', 'D'])],
  stations: [
    station('A', 'Alpha', 3.10, 101.60, ['L1']),
    station('X', 'Masjid Jamek', 3.1493, 101.6964, ['L1', 'L2']),
    station('B', 'Bravo', 3.20, 101.80, ['L1']),
    station('C', 'Charlie', 3.05, 101.65, ['L2']),
    station('D', 'Delta', 3.25, 101.75, ['L2']),
  ],
}
const near = { lat: 3.1500, lng: 101.6964 } // ~80 m north of X
const far = { lat: 3.1529, lng: 101.6964 } // ~400 m north of X

test('stationForPlace: a station-category result 80 m away maps to the station', () => {
  assert.equal(stationForPlace(data, { name: 'Masjid Jamek LRT', category: 'Station', ...near })?.id, 'X')
})

test('stationForPlace: a restaurant at the same spot is not a station', () => {
  assert.equal(stationForPlace(data, { name: 'Nasi Kandar Pelita', category: 'Restaurant', ...near }), null)
})

test('stationForPlace: a matching station 400 m away is too far', () => {
  assert.equal(stationForPlace(data, { name: 'Masjid Jamek', category: 'Station', ...far }), null)
})

test('stationForPlace: name match counts even without a station category', () => {
  assert.equal(stationForPlace(data, { name: 'Stesen LRT Masjid Jamek', category: 'Building', ...near })?.id, 'X')
})

test('defaultDir: from the first stop of dir 0 go dir 0; from its last stop go dir 1', () => {
  assert.equal(defaultDir(data.lines[0], 'A'), 0)
  assert.equal(defaultDir(data.lines[0], 'B'), 1)
})

test('linesAt lists every line at an interchange; stopIndex is -1 for absent stations', () => {
  assert.deepEqual(linesAt(data, 'X').map(l => l.id), ['L1', 'L2'])
  assert.equal(stopIndex(data.lines[0].directions[0], 'D'), -1)
})

test('nearestStation respects maxM', () => {
  assert.equal(nearestStation(data, near.lng, near.lat, 150)?.id, 'X')
  assert.equal(nearestStation(data, far.lng, far.lat, 150), null)
})

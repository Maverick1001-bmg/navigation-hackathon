import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv, parseTime, cleanName, groupStops } from './build-transit-data.mjs'

test('parseCsv strips the BOM and maps rows to header keys', () => {
  assert.deepEqual(parseCsv('﻿a,b\n1,2\n'), [{ a: '1', b: '2' }])
})

test('parseTime handles single-digit hours and 24:00:00', () => {
  assert.equal(parseTime('6:00:18'), 21618)
  assert.equal(parseTime('24:00:00'), 86400)
})

test('cleanName strips sponsor suffixes and title-cases ALL-CAPS names', () => {
  assert.equal(cleanName('BANDARAYA - UOB'), 'Bandaraya')
  assert.equal(cleanName('KL SENTRAL - REDONE'), 'KL Sentral')
  assert.equal(cleanName('MASJID JAMEK'), 'Masjid Jamek')
  assert.equal(cleanName('PWTC'), 'PWTC')
  assert.equal(cleanName('SunU-Monash'), 'SunU-Monash')
})

// ~100 m apart along a meridian: 0.0009 deg lat
const stop = (id, lat, lon) => ({ stop_id: id, stop_name: id, stop_lat: String(lat), stop_lon: String(lon) })
const A = stop('A', 3.1, 101.7)
const B = stop('B', 3.1009, 101.7)
const C = stop('C', 3.118, 101.7) // ~2 km away

test('groupStops merges stops within maxM', () => {
  const groups = groupStops([A, B, C], 250, [])
  assert.equal(groups.length, 2)
  assert.deepEqual(groups.find(g => g.stopIds.length === 2).stopIds, ['A', 'B'])
})

test('groupStops applies merge overrides regardless of distance', () => {
  const groups = groupStops([A, B, C], 50, [['A', 'C']])
  assert.equal(groups.length, 2)
  assert.deepEqual(groups.find(g => g.stopIds.includes('A')).stopIds, ['A', 'C'])
  assert.deepEqual(groups.find(g => g.stopIds.includes('B')).stopIds, ['B'])
})

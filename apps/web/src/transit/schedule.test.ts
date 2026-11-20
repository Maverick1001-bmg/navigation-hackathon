import { test } from 'node:test'
import assert from 'node:assert/strict'
import { klClock, headwayAt, firstLast, formatClock, stationStatus } from './schedule.ts'
import type { Direction, ServiceSchedule } from './types.ts'

const h = (hh: number, mm = 0) => hh * 3600 + mm * 60

const AMPANG_MONFRI: ServiceSchedule = {
  periods: [
    { from: h(6), to: h(9), headwayS: 180 },
    { from: h(9), to: h(17), headwayS: 300 },
    { from: h(17), to: h(19), headwayS: 180 },
    { from: h(19), to: h(23, 25), headwayS: 300 },
  ],
}

test('klClock: Friday 08:00 KL is the MonFri service', () => {
  assert.deepEqual(klClock(new Date('2026-11-20T00:00:00Z')), { service: 'MonFri', secs: 28800 })
})

test('klClock: Saturday 00:30 KL still belongs to Friday (MonFri) service', () => {
  assert.deepEqual(klClock(new Date('2026-11-20T16:30:00Z')), { service: 'MonFri', secs: 88200 })
})

test('klClock: Monday 00:30 KL belongs to Sunday service', () => {
  assert.deepEqual(klClock(new Date('2026-11-22T16:30:00Z')), { service: 'Sun', secs: 88200 })
})

test('klClock: Saturday 10:00 KL is the Sat service', () => {
  assert.deepEqual(klClock(new Date('2026-11-21T02:00:00Z')), { service: 'Sat', secs: 36000 })
})

test('headwayAt returns the period headway, null outside service', () => {
  assert.equal(headwayAt(AMPANG_MONFRI, h(7)), 180)
  assert.equal(headwayAt(AMPANG_MONFRI, h(23, 30)), null)
  assert.equal(headwayAt(AMPANG_MONFRI, h(5)), null)
})

test('firstLast: last train is one headway before the exclusive end, plus station offset', () => {
  assert.deepEqual(firstLast(AMPANG_MONFRI, 120), { first: 21720, last: 84120 })
})

test('formatClock pads and marks times after midnight', () => {
  assert.equal(formatClock(21720), '06:02')
  assert.equal(formatClock(86400 + 720), '00:12 (after midnight)')
})

const KJ_LIKE: ServiceSchedule = {
  periods: [
    { from: h(6), to: h(9), headwayS: 240 },
    { from: h(9), to: h(23, 15), headwayS: 420 },
  ],
}
const direction: Direction = {
  dir: 0,
  headsign: 'Gombak',
  shape: [],
  stops: [{ stationId: 'S1', offsetS: 0 }, { stationId: 'S2', offsetS: 600 }],
  service: { MonFri: KJ_LIKE, Sat: KJ_LIKE, Sun: KJ_LIKE },
}

test('stationStatus: closed at 23:50 Friday on a line ending 23:15, opens 06:00', () => {
  const s = stationStatus(direction, 'S1', new Date('2026-11-20T15:50:00Z'))
  assert.equal(s.open, false)
  assert.ok(!s.open && formatClock(s.opensAt) === '06:00')
})

test('stationStatus: open at 08:00 with peak headway in minutes', () => {
  const s = stationStatus(direction, 'S2', new Date('2026-11-20T00:00:00Z'))
  assert.equal(s.open, true)
  assert.ok(s.open && s.everyMin === 4)
})

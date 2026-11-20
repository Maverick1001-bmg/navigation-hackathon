import type { Direction, ServiceKey, ServiceSchedule } from './types.ts'

const DAY = 86400
const KL_OFFSET_S = 8 * 3600 // UTC+8, no DST
/** Before this time of day, trains still belong to the previous day's service. */
const SERVICE_DAY_START_S = 3 * 3600

const SERVICE_BY_WEEKDAY: ServiceKey[] = ['Sun', 'MonFri', 'MonFri', 'MonFri', 'MonFri', 'MonFri', 'Sat']

/** Which service applies right now in KL, and seconds since that service day's midnight. */
export function klClock(now: Date): { service: ServiceKey; secs: number } {
  const kl = new Date(now.getTime() + KL_OFFSET_S * 1000) // read with getUTC* = KL wall clock
  let weekday = kl.getUTCDay()
  let secs = kl.getUTCHours() * 3600 + kl.getUTCMinutes() * 60 + kl.getUTCSeconds()
  if (secs < SERVICE_DAY_START_S) {
    weekday = (weekday + 6) % 7
    secs += DAY
  }
  return { service: SERVICE_BY_WEEKDAY[weekday], secs }
}

export function headwayAt(s: ServiceSchedule, secs: number): number | null {
  const p = s.periods.find(p => p.from <= secs && secs < p.to)
  return p ? p.headwayS : null
}

export function firstLast(s: ServiceSchedule, offsetS: number): { first: number; last: number } {
  const firstPeriod = s.periods[0]
  const lastPeriod = s.periods[s.periods.length - 1]
  return {
    first: firstPeriod.from + offsetS,
    last: lastPeriod.to - lastPeriod.headwayS + offsetS,
  }
}

export function formatClock(secs: number): string {
  const t = Math.round(secs / 60) * 60
  const wrapped = t % DAY
  const hh = String(Math.floor(wrapped / 3600)).padStart(2, '0')
  const mm = String(Math.floor((wrapped % 3600) / 60)).padStart(2, '0')
  return t >= DAY ? `${hh}:${mm} (after midnight)` : `${hh}:${mm}`
}

export type StationStatus =
  | { open: true; everyMin: number; first: number; last: number }
  | { open: false; opensAt: number; first: number; last: number }

export function stationStatus(d: Direction, stationId: string, now: Date): StationStatus {
  const stop = d.stops.find(s => s.stationId === stationId)
  if (!stop) throw new Error(`Station ${stationId} is not on this direction`)
  const { service, secs } = klClock(now)
  const schedule = d.service[service]
  const { first, last } = firstLast(schedule, stop.offsetS)
  const headway = headwayAt(schedule, secs - stop.offsetS)
  return headway === null
    ? { open: false, opensAt: first, first, last }
    : { open: true, everyMin: Math.round(headway / 60), first, last }
}

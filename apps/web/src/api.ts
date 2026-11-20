// Client for services/api (see docs/CONTRACTS.md).
//
// Where the API lives, in priority order:
//   1. ?api=<url> in the page link (remembered on this device), e.g. a tunnel URL
//      https://navigation-hackathon.vercel.app/?api=https://xyz.trycloudflare.com
//   2. VITE_API_URL at build time (apps/web/.env.local, or Vercel env vars)
// ?api=off forgets a remembered URL.

export type LatLng = { lat: number; lng: number }

export type RouteStep = {
  text: string // e.g. "Turn left onto Jalan Ampang"
  distanceM: number // length of this step
  durationS: number // time for this step
  location: LatLng // where the maneuver happens
}

export type Route = {
  polyline: LatLng[]
  distanceM: number
  durationS: number
  incidentsOnRoute: string[]
  /** Turn-by-turn, in order. Optional: older API versions don't send it. */
  steps?: RouteStep[]
}

/** ?mocksteps in the page link: fake steps from the route shape when the API sends none. */
const MOCK_STEPS = new URLSearchParams(window.location.search).has('mocksteps')

const STORAGE_KEY = 'apiBase'

function readApiBase(): string | null {
  const fromLink = new URLSearchParams(window.location.search).get('api')
  try {
    if (fromLink === 'off') localStorage.removeItem(STORAGE_KEY)
    else if (fromLink) localStorage.setItem(STORAGE_KEY, fromLink)
  } catch { /* storage blocked: link value still used for this visit */ }
  if (fromLink && fromLink !== 'off') return fromLink

  let stored: string | null = null
  try { stored = localStorage.getItem(STORAGE_KEY) } catch { /* ignore */ }
  return stored || import.meta.env.VITE_API_URL || null
}

const raw = readApiBase()
export const API_BASE = raw ? raw.replace(/\/+$/, '') : null

/** Why routing can't work right now, or null if it should. */
export function apiProblem(): string | null {
  if (!API_BASE) return 'Routing server not set. Open the app with ?api=<server URL>.'
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(API_BASE)
  if (window.location.protocol === 'https:' && API_BASE.startsWith('http:') && !isLocal) {
    return 'Routing server must be https (use the tunnel URL).'
  }
  return null
}

export async function fetchRoute(from: LatLng, to: LatLng, signal?: AbortSignal): Promise<Route> {
  const problem = apiProblem()
  if (problem) throw new Error(problem)
  const q = new URLSearchParams({ from: `${from.lat},${from.lng}`, to: `${to.lat},${to.lng}` })
  let res: Response
  try {
    res = await fetch(`${API_BASE}/api/route?${q}`, { signal })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new Error('Could not reach the routing server.')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ? `Routing failed: ${body.error}` : `Routing failed (${res.status}).`)
  if (!Array.isArray(body.polyline) || body.polyline.length < 2) throw new Error('No route found.')
  const route = body as Route
  if (!Array.isArray(route.steps)) route.steps = undefined
  if (MOCK_STEPS && !route.steps?.length) route.steps = mockSteps(route)
  return route
}

// Testing aid until the API fills `steps`: a step at every sharp bend in the polyline.
function mockSteps(route: Route): RouteStep[] {
  const pts = route.polyline
  const speed = route.distanceM / Math.max(1, route.durationS)
  const turns: { at: number; text: string }[] = [{ at: 0, text: 'Head out along the route' }]
  for (let i = 1; i < pts.length - 1; i++) {
    let delta = bearing(pts[i], pts[i + 1]) - bearing(pts[i - 1], pts[i])
    delta = ((delta + 540) % 360) - 180
    if (Math.abs(delta) < 35 || segM(pts, turns[turns.length - 1].at, i) < 40) continue
    const side = delta > 0 ? 'right' : 'left'
    turns.push({ at: i, text: Math.abs(delta) > 120 ? `Sharp ${side}` : `Turn ${side}` })
  }
  turns.push({ at: pts.length - 1, text: 'Arrive at your destination' })
  return turns.map((t, k) => {
    const next = turns[k + 1]?.at ?? t.at
    const d = segM(pts, t.at, next)
    return { text: t.text, distanceM: d, durationS: d / speed, location: pts[t.at] }
  })
}

const rad = (d: number) => (d * Math.PI) / 180

/** Compass bearing from a to b, degrees clockwise from north. */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat))
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng))
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function segM(pts: LatLng[], from: number, to: number): number {
  let m = 0
  for (let i = from; i < to; i++) {
    const dLat = rad(pts[i + 1].lat - pts[i].lat)
    const dLng = rad(pts[i + 1].lng - pts[i].lng) * Math.cos(rad(pts[i].lat))
    m += 6_371_000 * Math.hypot(dLat, dLng)
  }
  return m
}

// ── Server status ──
// 'none'         no server address (opened without ?api=, nothing remembered)
// 'offline'      API unreachable (tunnel down, Codespace stopped, wrong URL)
// 'routing-down' API up but the routing engine (GraphHopper/Valhalla) isn't answering
// 'online'       both fine
export type ServerState = 'checking' | 'none' | 'offline' | 'routing-down' | 'online'
export type ServerStatus = { state: ServerState; engine?: string }

async function getJson(url: string, ms: number): Promise<{ ok: boolean; body: Record<string, unknown> }> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' })
    const body = await res.json().catch(() => ({}))
    return { ok: res.ok, body }
  } finally {
    clearTimeout(t)
  }
}

// A short route in central KL, to prove the routing engine itself answers
const PROBE = 'from=3.1390,101.6869&to=3.1450,101.6950'

export async function checkServer(): Promise<ServerStatus> {
  if (apiProblem()) return { state: 'none' }
  let engine: string | undefined
  try {
    const health = await getJson(`${API_BASE}/api/health`, 6000)
    // A dead tunnel often answers with an error page: require the real health reply
    if (!health.ok || health.body.ok !== true) return { state: 'offline' }
    engine = typeof health.body.routing === 'string' ? health.body.routing : undefined
  } catch {
    return { state: 'offline' }
  }
  try {
    const probe = await getJson(`${API_BASE}/api/route?${PROBE}`, 10000)
    return { state: probe.ok && Array.isArray(probe.body.polyline) ? 'online' : 'routing-down', engine }
  } catch {
    return { state: 'routing-down', engine }
  }
}

// ── Incidents ──
export const INCIDENT_TYPES = ['accident', 'police', 'flood', 'roadworks', 'jam', 'hazard'] as const
export type IncidentType = (typeof INCIDENT_TYPES)[number]

export type Incident = {
  id: string
  type: IncidentType
  location: LatLng
  reportedAt: string
  confirmations: number
  note?: string
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const problem = apiProblem()
  if (problem) throw new Error(problem)
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, init)
  } catch {
    throw new Error('Could not reach the server.')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`)
  return body as T
}

export const listIncidents = () => apiJson<Incident[]>('/api/incidents')

export const reportIncident = (type: IncidentType, location: LatLng, note?: string) =>
  apiJson<Incident>('/api/incidents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(note ? { type, location, note } : { type, location }),
  })

export const confirmIncident = (id: string) =>
  apiJson<Incident>(`/api/incidents/${encodeURIComponent(id)}/confirm`, { method: 'POST' })

export function timeAgo(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000))
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  return `${h} h ago`
}

export function formatDuration(s: number): string {
  const min = Math.max(1, Math.round(s / 60))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

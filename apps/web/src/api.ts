// Client for services/api (see docs/CONTRACTS.md).
//
// Where the API lives, in priority order:
//   1. ?api=<url> in the page link (remembered on this device), e.g. a tunnel URL
//      https://navigation-hackathon.vercel.app/?api=https://xyz.trycloudflare.com
//   2. VITE_API_URL at build time (apps/web/.env.local, or Vercel env vars)
// ?api=off forgets a remembered URL.

export type LatLng = { lat: number; lng: number }

export type Route = {
  polyline: LatLng[]
  distanceM: number
  durationS: number
  incidentsOnRoute: string[]
}

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
  return body as Route
}

export function formatDuration(s: number): string {
  const min = Math.max(1, Math.round(s / 60))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

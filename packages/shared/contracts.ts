// Shared frontend ↔ backend types. Source of truth: docs/CONTRACTS.md (keep both in sync).

export type LatLng = { lat: number; lng: number }

export type IncidentType = 'accident' | 'police' | 'flood' | 'roadworks' | 'jam' | 'hazard'

export type Incident = {
  id: string
  type: IncidentType
  location: LatLng
  reportedAt: string // ISO timestamp
  confirmations: number // upvotes from other drivers
  note?: string
}

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
  incidentsOnRoute: string[] // Incident ids
  steps?: RouteStep[] // turn-by-turn, in order. Optional: may be missing or empty
}

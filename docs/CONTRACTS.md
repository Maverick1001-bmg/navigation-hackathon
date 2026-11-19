# Shared contracts (frontend ↔ backend)

Agree on this in the first 20 minutes and merge it before anyone builds. Changes after that: announce in chat, additive only, separate `contract:` PR.

Example starting point — edit to fit your idea:

## Types

```ts
type LatLng = { lat: number; lng: number };

type Incident = {
  id: string;
  type: "accident" | "police" | "flood" | "roadworks" | "jam" | "hazard";
  location: LatLng;
  reportedAt: string;      // ISO timestamp
  confirmations: number;   // upvotes from other drivers
  note?: string;
};

type Route = {
  polyline: LatLng[];
  distanceM: number;
  durationS: number;
  incidentsOnRoute: string[]; // Incident ids
};
```

## Endpoints

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/api/incidents?bbox=minLng,minLat,maxLng,maxLat` | — | `Incident[]` |
| POST | `/api/incidents` | `{ type, location, note? }` | `Incident` |
| POST | `/api/incidents/:id/confirm` | — | `Incident` |
| GET | `/api/route?from=lat,lng&to=lat,lng` | — | `Route` |

Base URL in the frontend comes from `VITE_API_URL` / `NEXT_PUBLIC_API_URL` (see `.env.example`).

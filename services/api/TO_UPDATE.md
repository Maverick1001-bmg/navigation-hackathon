# TO_UPDATE (for the Lead)

## Status for the Lead's Claude
Merged: API (#6, #8), web directions (#9), web incident reports (#10). `?api=<tunnel URL>` is now read by `apps/web/src/api.ts`.

Still to check on the frontend (Lead / Member A's area, not `services/api/`):
1. Place search did not work well for Cheryl on the live site. Photon itself responds (`https://photon.komoot.io/api/?q=klcc`), so reproduce it on the Vercel build and check the browser console.
2. Warn the driver when `incidentsOnRoute` on the `Route` is not empty (the API fills it with incidents within 50 m of the route).
3. Check that the latest Vercel deploy matches `main`.

API facts: CORS is open (incl. `OPTIONS` 204), 18 seeded KL incidents, reports live in memory and clear on API restart. Cheryl runs the API plus a Cloudflare tunnel from her Codespace; the tunnel URL changes on restart, so ask Cheryl for the current one. Phone link: `https://navigation-hackathon.vercel.app/?api=<tunnel URL>`

## Turn-by-turn instructions: what the Lead's Claude needs to do
Turn-by-turn is not implemented anywhere yet. `/api/route` returns only `polyline`, `distanceM`, `durationS`, `incidentsOnRoute`. Cheryl's side (API) will fill the new field once the contract exists.

**1. Contract (Lead's area; announce in chat, then a small PR titled `contract: route steps`).** Additive and optional, so nothing breaks. Update both `docs/CONTRACTS.md` and `packages/shared/`:

```ts
type RouteStep = {
  text: string;        // e.g. "Turn left onto Jalan Ampang"
  distanceM: number;   // length of this step
  durationS: number;   // time for this step
  location: LatLng;    // where the maneuver happens
};

type Route = {
  // ...existing fields...
  steps?: RouteStep[]; // new, optional
};
```

Tell Cheryl as soon as it is merged. She will then add `steps` to both engines (GraphHopper and Valhalla) in `services/api/`.

**2. Frontend (`apps/web/`, Lead / Member A).** After the contract is merged:
- Add a turn-by-turn panel under the route card. For each `steps[]` item show `text` and `distanceM`.
- Highlight the current step using GPS: the step whose `location` is next and closest.
- Handle `steps` being missing or empty (old API, or no instructions): hide the panel, do not crash.
- Until the API sends real steps, test with a hard-coded mock `steps` array.

## Decisions to note
- Routing engine is switchable (GraphHopper default, Valhalla optional). Valhalla is a US-origin (Mapzen) tool that the project's no-US constraint excluded; an exception was approved for it.
- Public OSM raster tiles (tile.openstreetmap.org) are for the demo only. Their policy forbids heavy/production use.

## Done
- Routing env vars are in `.env.example` (#7).

## Possible `contract:` PRs (additive only, need announcement first)
- Traffic-light count on `Route`, e.g. optional `trafficSignals?: number` (from OSM `highway=traffic_signals`).
- Search/geocoding endpoint (Photon/Nominatim) is not in `docs/CONTRACTS.md`.

## Flag
- Repo tooling uses GitHub and Codespaces (Microsoft/US), which conflicts with the no-US constraint.

# TO_UPDATE (for the Lead)

Things outside `services/api/` that need updating. Branch: `cheryl/routing-adapter`.

## `.env.example` (root config)
Add these variable names (no values/secrets):

```

```

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

## Possible `contract:` PRs (additive only, need announcement first)
- Traffic-light count on `Route`, e.g. optional `trafficSignals?: number` (from OSM `highway=traffic_signals`).
- Search/geocoding endpoint (Photon/Nominatim) is not in `docs/CONTRACTS.md`.

## Flag
- Repo tooling uses GitHub and Codespaces (Microsoft/US), which conflicts with the no-US constraint.

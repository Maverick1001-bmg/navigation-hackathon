# TO_UPDATE (for the Lead)

Things outside `services/api/` that need updating. Branch: `cheryl/routing-adapter`.

## `.env.example` (root config)
Add these variable names (no values/secrets):

```
ROUTING_PROVIDER=graphhopper   # or: valhalla
GRAPHHOPPER_URL=http://localhost:8989
VALHALLA_URL=http://localhost:8002
```

## Decisions to note
- Routing engine is switchable (GraphHopper default, Valhalla optional). Valhalla is a US-origin (Mapzen) tool that the project's no-US constraint excluded; an exception was approved for it.
- Public OSM raster tiles (tile.openstreetmap.org) are for the demo only. Their policy forbids heavy/production use.

## Possible `contract:` PRs (additive only, need announcement first)
- Traffic-light count on `Route`, e.g. optional `trafficSignals?: number` (from OSM `highway=traffic_signals`).
- Search/geocoding endpoint (Photon/Nominatim) is not in `docs/CONTRACTS.md`.

## Flag
- Repo tooling uses GitHub and Codespaces (Microsoft/US), which conflicts with the no-US constraint.

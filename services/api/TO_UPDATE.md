# TO_UPDATE (for the Lead)

## Message for the Lead's Claude: problem on the frontend side

The API side is done and merged (PRs #6 and #8). The live site can't use it yet because `apps/web/` on `main` has no code that calls it. Please do the following in `apps/web/` (the Lead / Member A's area, not `services/api/`):

**Problems seen on https://navigation-hackathon.vercel.app**
1. There is no "get directions" feature. Nothing in `apps/web/src` calls `/api/route`.
2. Nothing reads the API address from the link (`?api=<tunnel URL>`), so the site can't reach the API running in Cheryl's Codespace.
3. No report button or incident markers. Nothing calls `/api/incidents`.
4. Place search doesn't work properly for Cheryl on the live site. The Photon service itself responds (tested `https://photon.komoot.io/api/?q=klcc`), so the bug is likely in `apps/web/src/photon.ts` / `SearchBox.tsx`, or the Vercel build is older than `main`. Please reproduce it and check the browser console.

**Next actions**
- Read `?api=` from the page URL and use it as the API base (fall back to `VITE_API_URL`).
- Add directions: pick from/to, call `GET {api}/api/route?from=lat,lng&to=lat,lng`, draw `polyline` on the map, show `durationS` and `distanceM` on the card.
- Add incidents: `GET {api}/api/incidents` every ~5 s for markers, `POST {api}/api/incidents` (JSON `{type, location, note?}`) for the report button, `POST {api}/api/incidents/:id/confirm`. Show a warning when `incidentsOnRoute` is not empty.
- Call `GET {api}/api/health` first to check the connection.
- Check that the latest Vercel deploy matches `main`.

**API facts (already working)**
- CORS is open, including `OPTIONS` preflight (204) for POST with JSON.
- Seeded with 18 KL incidents; reports are in memory and clear when the API restarts.
- Cheryl runs the API plus a Cloudflare tunnel from her Codespace, so the tunnel URL changes on restart. Ask Cheryl for the current one. It must stay running during the demo.
- Phone link format: `https://navigation-hackathon.vercel.app/?api=<tunnel URL>`

---

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

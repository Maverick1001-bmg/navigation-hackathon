# Transit: station & line view (Rapid KL rail) — design

Date: 2026-11-20 · Owner: Barath (Lead) · Area: `apps/web/` · Branch: `barath/transit-lines` (own worktree: `../hackathon-kit-transit`, so it never shares a working copy with `barath/directions`)

## Why

The app is community-powered navigation for Malaysia. Driving routing is owned by a teammate. Barath is adding **public transport** so a KL user can understand the rail network the way they would in Google Maps: tap a station, see which lines stop there, tap a line and see its full extent and the stops ahead.

This is phase 1 of the transit work. Agreed order:

1. **Station & line view** (this doc)
2. Live Rapid KL bus positions (data.gov.my GTFS-Realtime)
3. Trip planning (Transitous / MOTIS API); will reuse this doc's line highlight to draw rail legs

## Goals

- Rapid KL rail network on the map: LRT (Ampang, Sri Petaling, Kelana Jaya, Shah Alam), MRT (Kajang, Putrajaya), KL Monorail, Sunway BRT.
- One clickable dot per **physical station** (interchanges merged).
- **Station card** → list of lines at that station → tap a line → **line card** + the line highlighted end-to-end on the map, rest of the network faded, camera fitted to the line.
- Line card shows the ordered stop list in one direction, the current station marked, "+N min" scheduled travel time to each stop ahead, and a direction swap.
- Cards, pins and dots stay in sync: exactly one selection at a time.
- Remove the duplicate-dot confusion: hide the base map's own station icons.

## Non-goals (this phase)

- **KTM Komuter** — hidden entirely for now (KTMB GTFS has exact times but no track shapes; adds ~30–45 min). Pick up later.
- **Transit community reporting** (delays, crowding) — deferred, pick up later.
- Live train positions (no live rail feed exists), live buses, trip planning — later phases.
- Any backend, contract (`docs/CONTRACTS.md`) or `packages/shared` change.

## Anti-goals

- Anything that looks like live tracking when it isn't. All times are labelled **scheduled**.
- Two kinds of station dots that behave differently.
- Official line colours always on: red/blue clash with the app's reserved colours (blue = driving route, red = incidents). Tracks are **grey by default**; a line takes its official colour only while highlighted.
- Duplicate tracks. The base map already draws every rail track (KTM included) in grey; we do not draw a second grey network on top.

## Constraints

- 4-hour hackathon; small, runnable commits; stay inside `apps/web/` (plus this doc).
- No new runtime dependencies. Stack: Vite + React 19 + TS + MapLibre 6, OpenFreeMap liberty style.
- Must work on phones (cards become a bottom sheet under 700 px, like `PlaceCard`).
- Demo must not depend on data.gov.my being up at demo time.

## Approaches considered

| | Approach | Trade-off | Verdict |
|---|---|---|---|
| A | **Everything in the web app; GTFS converted once to a bundled JSON file** | No network at runtime, no deps, stays in Barath's lane | **Picked** |
| B | Backend proxy in `services/api` serving transit JSON | Cleaner split, but needs a contract change and Member B's time | Rejected for time |
| C | Self-host a GTFS trip planner (OTP/MOTIS) | Heavy, needs Docker (not installed) | Ruled out |

Station dots — options considered: (1) Rapid KL only, hide base icons; (2) include KTM; (3) keep base KTM icons alongside ours. **Picked (1).**

## Data (verified 2026-11-20)

Source: `https://api.data.gov.my/gtfs-static/prasarana?category=rapid-rail-kl` (zip, ~80 KB, no key; follows a 301 to a trailing-slash URL).

| File | Use | Notes |
|---|---|---|
| `routes.txt` | 8 lines, `route_color`, short/long names | `route_id`: AG, KJ, PH, KGL, PYL, MR, BRT, SA |
| `trips.txt` | trip → route, direction (0/1), headsign, `shape_id` | One trip per route × service × direction (e.g. `AGL_MonFri_0`) |
| `stop_times.txt` | ordered stops per trip with arrival times | Its `route_id` column uses different codes (`AGL`) than `routes.txt` (`AG`) — **join through `trips.txt` by `trip_id`**, ignore that column. File starts with a UTF-8 BOM. |
| `frequencies.txt` | headway per period, per trip | No `exact_times` → frequency-based; end times can be `24:00:00`. Example: Ampang Line weekdays 6:00–23:25, 3 min peak / 5 min off-peak |
| `calendar.txt` | service days | Use `MonFri`, `Sat`, `Sun` (also present: `SatSun`, `MonThu`, `Fri`, and expired `weekday`/`weekend`). Pick the service by today's weekday in Asia/Kuala_Lumpur. |
| `shapes.txt` | track geometry per direction | ~7.3k points total |
| `stops.txt` | 187 stop entries | Names ALL CAPS, some with sponsor suffixes (`BANDARAYA - UOB`, `KL SENTRAL - REDONE`); `geometry` column is junk (`[object Object]`) |

Comparison with the base map (OpenStreetMap stations): 182/187 stops have a base-map station within 300 m (median 20 m). The 5 Sunway BRT stops exist only in our data; 31 KTM stations exist only in the base map.

Interchange grouping: merging stops within 250 m yields **159 stations, 22 interchanges** (e.g. Titiwangsa = AG3/SP3/PY17/MR11). 250 m also merges Plaza Rakyat (AG8/SP8) with Merdeka (KG17) — the builder decides per case via an override list (see below).

## Design

### Build-time data step

A Node script (`apps/web/scripts/build-transit-data.mjs`, no deps; runnable with `node`) reads the GTFS `.txt` files and writes **`apps/web/src/transit/rapidRail.json`**, which is **committed**. The script is run by hand, not on every build. Raw GTFS files are not committed.

The JSON holds:

- `lines[]`: `{ id, shortName, name, colour, directions: [{ dir, headsign, shape: [lng,lat][], stops: [{ stationId, offsetS }], service: { MonFri|Sat|Sun: { first, last, periods: [{ from, to, headwayS }] } } }] }` — `offsetS` = seconds from the first stop of that direction (from `stop_times` arrival times).
- `stations[]`: `{ id, name, lng, lat, lineIds[], stopIds[] }` — merged interchanges; display name title-cased with sponsor suffix stripped; small `NAME_OVERRIDES` and `MERGE_OVERRIDES` maps at the top of the script.
- Coordinates rounded to 5 decimals to keep the file small.

### Map layers (`apps/web/src/transit/transitLayer.ts`)

Modelled on Google Maps' transit line view (Barath's call: grey tracks by default, mute the rest when one line is highlighted).

**Default (nothing highlighted):** the base map's own grey rail tracks are the network — no track layer of ours. On top we draw only the **station dots**: small white dots with a grey ring, one per station, visible from zoom ~12 (interchanges slightly larger).

**Line highlighted** (Google Maps style):
- The selected line's shape in its **official colour**, thick, with a thin white casing so it reads over roads; drawn above roads, below labels.
- Its stops: **white circles with a ring in the line colour**; interchanges slightly larger; the current station larger still. Stop names shown as labels next to the dots (from zoom ~12).
- **Everything else muted:** base-map rail tracks drop to low opacity, and station dots not on the line fade (still tappable).
- Camera fits the line.

**Selected station** (no line highlighted): larger dot, like the active search dot.

Same code pattern as `searchLayer.ts` (GeoJSON sources, returns a small controller): `setHighlight(lineId | null, dir)`, `setSelectedStation(id | null)`, `remove()`, click callback `onStationClick(stationId)`.

Base-map changes (both in `mapTheme.ts`, which is in `apps/web/`):
- `SHOW_RAIL_STATIONS = false` (existing flag) hides the base `poi_transit` icons, KTM included.
- New small export, e.g. `setRailMuted(map, muted: boolean)`, which sets `line-opacity` on the base `rail`-tier layers. No recolouring of the base map.

### Isolation from driving directions (Barath's call)

A teammate is live-debugging driving directions in `App.tsx`, `PlaceCard.tsx`, `index.css`, `photon.ts`, `routeLayer.ts`, `api.ts` (branch `barath/directions`). Transit must not refactor any of that.

- **All transit code lives in `apps/web/src/transit/`**: `rapidRail.json`, `transitLayer.ts`, `useTransit.ts` (state + transitions below), `StationCard.tsx`, `LineCard.tsx`, `transit.css` (imported by the transit components; reuses `place-card` class names for the look, adds `transit-*` classes for the rest). Nothing transit-specific goes in `index.css`.
- **The existing place state (`selectedPlace`, `cardOpen`, pin, directions) is not restructured.** No app-wide `Selection` union.
- **`App.tsx` gets only small, additive hook-ups**, each marked `// transit`:
  1. `const transit = useTransit(map, { onOpen: () => setCardOpen(false) })` — opening a station/line card hides the place card (pin and directions destination stay, same as pressing × today).
  2. In the search `onSelect` path, `if (transit.openStationForPlace(place)) return` before `showPlace(place)` (the 150 m station check).
  3. When a place card opens (inside `showPlace` or where `setCardOpen(true)` is called), `transit.close()`.
  4. Render `{transit.card}` next to `PlaceCard`.
- **`mapTheme.ts`**: flip `SHOW_RAIL_STATIONS` to `false` and add `setRailMuted(map, muted)`. Only additive.
- Merge order: whichever lands second rebases; conflicts should be limited to those four `App.tsx` lines.
- **Driving route is untouched by transit:** selecting a station or line never clears a drawn driving route, and vice versa.

### Transit selection (inside `useTransit`)

```ts
type TransitSelection =
  | { kind: 'none' }
  | { kind: 'station'; stationId: string }                            // StationCard
  | { kind: 'line'; lineId: string; dir: 0 | 1; stationId: string }   // LineCard + highlight
```

At most one card is open app-wide: transit and place cards close each other via the hook-ups above. Dots and highlight are derived from the transit selection.

Transitions:

| From | Action | To |
|---|---|---|
| any | tap a station dot | `station` (place card hides, its pin stays; highlight clears) |
| any | pick a search result that is a station (within 150 m of one of our stations) | `station` for that station |
| any | pick another search result, or tap the place pin | transit → `none`; place card opens (existing behaviour) |
| `station` | tap a line row | `line` (dir = the direction with more stops ahead of this station, i.e. toward the farther terminus; at a terminus, the only one) |
| `line` | tap a stop in the list, or a dot on the highlighted line | `line` with that `stationId` ("you're here" moves) |
| `line` | tap a dot not on the highlighted line | `station` for that dot |
| `line` | swap direction | `line` with other `dir` |
| `line` | ← back | `station` (same station) |
| station/line | × close | `none` (highlight and rail muting cleared) |

Camera: entering `station` → ease to the station (zoom ≥ 14, keep current if already closer). Entering `line` → `fitBounds` of the line shape (same padding helper as search). Moving "you're here" or swapping direction does not move the camera.

### Cards

Reuse the existing `place-card` look (same container, close button, typography, bottom sheet on phones) via its class names; transit-only styles go in `transit/transit.css`.

**StationCard**: name; meta line ("LRT · MRT · 3 lines"); one row per line: colour chip, line name, the two termini ("Gombak ⇄ Putra Heights"), "every N min" right now (or "Closed · opens 06:00" outside hours). "Scheduled" label. First/last train times are per direction, so they live on the LineCard (which has a direction), not here.

**LineCard**: back arrow + line name in its colour; "To <terminus>" with ⇄ swap; "every N min now · last train HH:MM (scheduled)"; vertical stop list with a coloured rail, the current station marked "you're here", stops ahead showing "+N min" (difference of `offsetS`), stops behind dimmed. List scrolls the current station into view.

Times (frequency data has no exact departures, so **no "next train in X min"** is shown — only the gap between trains):
- First train at a station = first period `from` + station `offsetS`.
- Last train at a station = (last period `to` − that period's `headwayS`) + `offsetS`: `end_time` is exclusive, so the last departure is about one headway before it.
- Times ≥ 24:00 display as e.g. "00:12 (after midnight)".
- **Service day:** before 03:00 KL time, use the previous day's service and treat the clock as +24 h, so Friday-night trains still show as running at 00:30 Saturday. "Every N min now" and open/closed use this same rule.

### Search link

When the user picks a Photon result, before opening a `place`, check the nearest station: if within 150 m and the result looks like a station (Photon `osm_key=railway` or `public_transport`, or name contains the station name), open `station` instead.

## Testing

- `npm run build` and `npm run lint` pass.
- Script sanity output: counts of lines (8), stations (~159), interchanges (~22); prints merged groups for eyeballing.
- Manual browser check: tap Masjid Jamek → 3 lines; tap Kelana Jaya → whole line highlighted in its colour, other tracks muted, stops listed with +min; swap direction; back; search "KL Sentral" → station card; × clears everything; base-map station icons gone; phone width bottom sheet.

## Left to the builder

- Exact zoom thresholds, line widths, fade opacity, dot sizes.
- Contents of `NAME_OVERRIDES` / `MERGE_OVERRIDES` after eyeballing the grouping output.
- How the "is it a station" search check is phrased, within the rule above.
- Exact shape of the `useTransit` return value, within the four hook-ups above.

## Later (recorded so they aren't lost)

- **KTM Komuter**: add KTMB GTFS (`/gtfs-static/ktmb`) stations + exact next departures; no shapes, so highlight stations only. Hidden for now.
- **Transit community reporting**: users report delays/crowding on a line or station; fits the existing `Incident` contract idea.
- Phase 2 live buses, phase 3 trip planning (see Why).

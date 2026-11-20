# Transit Station & Line View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tap a Rapid KL rail station to see its lines; tap a line to highlight it end-to-end (Google Maps style) with its stops and scheduled times.

**Architecture:** GTFS is converted once by a Node script into a committed JSON file. Pure TypeScript modules (`schedule.ts`, `lookup.ts`) hold the time and lookup logic and are unit-tested with `node --test`. A MapLibre layer controller (`transitLayer.ts`), two cards, and a `useTransit` hook live in `apps/web/src/transit/`. `App.tsx` gets four marked one-line hook-ups.

**Tech Stack:** Vite 8, React 19, TypeScript 7, MapLibre GL 6, Node 24 (built-in `node:test` with native TS type stripping; no new dependencies).

**Spec:** `docs/superpowers/specs/2026-11-20-transit-station-line-view-design.md`

## Global Constraints

- Work only in the worktree `Navigation Hackathon/hackathon-kit-transit` on branch `barath/transit-lines`. Never edit the `hackathon-kit/` folder (driving-directions work in progress).
- Edit only `apps/web/` and `docs/superpowers/`. **No new dependencies**; `package.json` is untouched.
- All transit code lives in `apps/web/src/transit/`. Nothing transit-specific goes in `index.css`.
- `App.tsx`: only four additive hook-ups, each with a `// transit` comment. `mapTheme.ts`: flip `SHOW_RAIL_STATIONS` to `false` and add `setRailMuted`, nothing else. Do not restructure `selectedPlace`/`cardOpen`/pin/directions.
- No base-map recolouring. Tracks are the base map's grey rail; our only always-on layer is station dots.
- Highlighted line = official `route_color`; no other official colours are shown when nothing is highlighted (red = incidents, blue = driving route).
- Every time shown in the UI is labelled **scheduled**. No "next train in X min".
- KTM hidden (base `poi_transit` icons off). No KTM data.
- Commits: `web: …` / `docs: …`, small, app runnable after each; end messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Pure modules import with explicit `.ts` extensions and use only erasable TS syntax (no enums, no namespaces, no parameter properties) so `node --test` can run them.

## Review Focus

1. **Theme toggle while a line is highlighted**: highlight colour, stop rings and rail muting all survive a light/dark switch. Check: Task 7, Step 5.
2. **Overlapping click targets**: a station dot under a purple search-result dot or the place pin opens exactly one card, never two. Check: Task 7, Step 6.
3. **Phone width with a long line** (Kelana Jaya, 37 stops): the line card scrolls inside the bottom sheet, the current station is scrolled into view, and the map above stays usable. Check: Task 7, Step 4.
4. **Late night and closed hours**: at 00:30 Saturday, Friday's service still shows "every N min"; at 23:50 on a weekday, the Kelana Jaya Line (ends 23:15) shows "Closed · opens 06:00". Check: Task 2 tests.
5. **Remount / StrictMode double effects**: dev mode mounts effects twice; there are no duplicate-source errors, and `remove()` after the map is destroyed doesn't throw. Check: Task 7, Step 5.

---

### Task 0: Worktree ready

**Files:** none

- [ ] **Step 1:** From `hackathon-kit-transit/`, run `git pull --rebase origin main`. Expected: up to date or a clean rebase.
- [ ] **Step 2:** From `hackathon-kit-transit/apps/web`, run `npm ci`. Expected: installs with no errors (the worktree has no `node_modules` yet).
- [ ] **Step 3:** Run `npm run build && npm run lint`. Expected: both pass on the untouched branch. This is the baseline.

---

### Task 1: GTFS → `rapidRail.json`

**Files:**
- Create: `apps/web/scripts/build-transit-data.mjs` (exports pure helpers, runs `main()` only when executed directly)
- Create: `apps/web/scripts/build-transit-data.test.mjs`
- Create: `apps/web/src/transit/types.ts`
- Create (generated, committed): `apps/web/src/transit/rapidRail.json`

**Interfaces:**
- Produces `types.ts`:

```ts
export type ServiceKey = 'MonFri' | 'Sat' | 'Sun'
export type Period = { from: number; to: number; headwayS: number } // seconds since service-day midnight; may exceed 86400
export type ServiceSchedule = { periods: Period[] }                   // sorted by `from`
export type Direction = {
  dir: 0 | 1
  headsign: string                       // terminus name, cleaned, e.g. "Gombak"
  shape: [number, number][]              // [lng, lat], 5 dp
  stops: { stationId: string; offsetS: number }[] // in travel order; offsetS from first stop
  service: Record<ServiceKey, ServiceSchedule>
}
export type Line = { id: string; shortName: string; name: string; colour: string /* '#RRGGBB' */; directions: Direction[] }
export type Station = { id: string; name: string; lng: number; lat: number; lineIds: string[]; stopIds: string[] }
export type TransitData = { lines: Line[]; stations: Station[] }
```

- Produces from the script (named exports): `parseCsv(text: string): Record<string,string>[]` (strips BOM), `parseTime(hms: string): number` (`"24:00:00"` → 86400), `cleanName(raw: string): string`, `groupStops(stops: {stop_id, stop_name, stop_lat, stop_lon}[], maxM: number, mergeOverrides: string[][]): {stopIds: string[]; lng; lat; rawNames: string[]}[]`.

- [ ] **Step 1: Get the data (outside the repo)**

```bash
mkdir -p "$TEMP/gtfs-rail" && cd "$TEMP/gtfs-rail" \
  && curl -sL "https://api.data.gov.my/gtfs-static/prasarana?category=rapid-rail-kl" -o rail.zip \
  && tar -xf rail.zip
```
Expected: `routes.txt`, `trips.txt`, `stop_times.txt`, `frequencies.txt`, `shapes.txt`, `stops.txt`, `calendar.txt` in that folder.

- [ ] **Step 2: Write failing tests** in `build-transit-data.test.mjs` (`node:test` + `node:assert/strict`):
  - `parseCsv('﻿a,b\n1,2\n')` → `[{a:'1', b:'2'}]`
  - `parseTime('6:00:18')` → `21618`; `parseTime('24:00:00')` → `86400`
  - `cleanName('BANDARAYA - UOB')` → `'Bandaraya'`; `cleanName('KL SENTRAL - REDONE')` → `'KL Sentral'`; `cleanName('MASJID JAMEK')` → `'Masjid Jamek'`; `cleanName('PWTC')` → `'PWTC'`; `cleanName('SunU-Monash')` → `'SunU-Monash'` (a name that is already mixed case is left alone apart from suffix stripping)
  - `groupStops` with three stops: A and B 100 m apart, C 2 km away, maxM 250 → 2 groups, one with `stopIds` `['A','B']`; with `mergeOverrides: [['A','C']]` and maxM 50 → A and C grouped, B alone.

- [ ] **Step 3:** Run `node --test scripts/`. Expected: FAIL (exports missing).

- [ ] **Step 4: Implement the helpers and `main(gtfsDir, outFile)`.** Rules the code must follow:
  - Join `stop_times` → `trips` by `trip_id` (ignore `stop_times.route_id`, whose codes differ). Use only `MonFri`, `Sat`, `Sun` trips. Build stop order, `offsetS = arrival − first arrival`, and periods from `frequencies.txt` per trip. Use the `MonFri` trip's stop list and shape for each direction.
  - Group stops with "any member within 250 m" (haversine), plus `MERGE_OVERRIDES` (starts empty) and `NAME_OVERRIDES` (starts empty), both at the top of the file. Station `id` = the group's first `stop_id`; `name` = the `cleanName` of the shortest raw name, unless overridden; coordinates = mean of the members.
  - `cleanName`: drop everything after `' - '`; if the name is all upper case, title-case it but keep tokens in `ACRONYMS = ['KL','KLCC','PWTC','USJ','IOI','UIA','TTDI','KPJ','SS','UPM','LRT','MRT','BRT','PPR']` upper case. Add to the list after eyeballing the output.
  - `colour` = `'#' + route_color` upper-cased. Coordinates rounded to 5 dp.
  - `headsign` = the cleaned name of that direction's last station.
  - Print a summary: line count, station count, interchange count, and every multi-stop group as `id: names`.
  - Write `JSON.stringify(data)` (no pretty-printing) to `outFile`.
  - Run `main(process.argv[2], process.argv[3])` only when executed directly.

- [ ] **Step 5:** Run `node --test scripts/`. Expected: PASS.

- [ ] **Step 6: Generate.** Run `node scripts/build-transit-data.mjs "$TEMP/gtfs-rail" src/transit/rapidRail.json`. Expected summary: `8 lines, 159 stations, 22 interchanges`. Read the group list. If a merge is wrong (e.g. Plaza Rakyat + Merdeka should stay separate), split it by putting stops in `MERGE_OVERRIDES` as separate groups (support an explicit "keep apart" form if needed) and fix bad names in `NAME_OVERRIDES`. Rerun. File size should be under 400 KB.

- [ ] **Step 7:** Run `npm run build`. Expected: PASS (`types.ts` compiles).

- [ ] **Step 8: Commit**

```bash
git add scripts/ src/transit/types.ts src/transit/rapidRail.json
git commit -m "web: Rapid KL rail data from data.gov.my GTFS (script + generated JSON)"
```

---

### Task 2: Schedule logic (`schedule.ts`)

**Files:**
- Create: `apps/web/src/transit/schedule.ts`
- Test: `apps/web/src/transit/schedule.test.ts`

**Interfaces:**
- Consumes: `Period`, `ServiceSchedule`, `ServiceKey`, `Direction` from `./types.ts`
- Produces:

```ts
export function klClock(now: Date): { service: ServiceKey; secs: number }
// KL is UTC+8, no DST. Before 03:00 KL time → previous day's service, secs + 86400.
export function headwayAt(s: ServiceSchedule, secs: number): number | null // headwayS of the period with from <= secs < to, else null
export function firstLast(s: ServiceSchedule, offsetS: number): { first: number; last: number }
// first = periods[0].from + offsetS; last = lastPeriod.to - lastPeriod.headwayS + offsetS
export function formatClock(secs: number): string // "06:02"; secs >= 86400 → "00:12 (after midnight)"
export function stationStatus(d: Direction, stationId: string, now: Date):
  | { open: true; everyMin: number; first: number; last: number }
  | { open: false; opensAt: number; first: number; last: number }
// uses klClock; looks up headwayAt(service, secs - offsetS); opensAt = first
```

- [ ] **Step 1: Write failing tests** (`node:test`), using a fixture `AMPANG_MONFRI` with periods `6:00–9:00/180, 9:00–17:00/300, 17:00–19:00/180, 19:00–23:25/300` (in seconds):
  - `klClock(new Date('2026-11-20T00:00:00Z'))` (Fri 08:00 KL) → `{service:'MonFri', secs: 28800}`
  - `klClock(new Date('2026-11-20T16:30:00Z'))` (Sat 00:30 KL) → `{service:'MonFri', secs: 88200}`
  - `klClock(new Date('2026-11-22T16:30:00Z'))` (Mon 00:30 KL) → `{service:'Sun', secs: 88200}`
  - `klClock(new Date('2026-11-21T02:00:00Z'))` (Sat 10:00 KL) → `{service:'Sat', secs: 36000}`
  - `headwayAt(AMPANG_MONFRI, 7*3600)` → `180`; at `23*3600+30*60` → `null`; at `5*3600` → `null`
  - `firstLast(AMPANG_MONFRI, 120)` → `{ first: 21720, last: 84120 }` (06:00 + 2 min; 23:25 − 5 min headway + 2 min = 23:22)
  - `formatClock(21720)` → `'06:02'`; `formatClock(86400 + 720)` → `'00:12 (after midnight)'`
  - `stationStatus` for a Kelana-Jaya-like direction (MonFri last period ends 23:15) at Fri 23:50 KL → `open: false`, `formatClock(opensAt) === '06:00'` (offset 0)

- [ ] **Step 2:** Run `node --test src/transit/`. Expected: FAIL.
- [ ] **Step 3:** Implement `schedule.ts` against the signatures above.
- [ ] **Step 4:** Run `node --test src/transit/`. Expected: PASS. Then `npm run build`: PASS.
- [ ] **Step 5: Commit** `web: transit schedule helpers (service day, headway, first/last train)`

---

### Task 3: Lookup logic (`lookup.ts`)

**Files:**
- Create: `apps/web/src/transit/lookup.ts`
- Test: `apps/web/src/transit/lookup.test.ts`

**Interfaces:**
- Consumes: `TransitData`, `Line`, `Station`, `Direction` from `./types.ts`
- Produces:

```ts
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number // own haversine; don't import photon.ts
export function nearestStation(data: TransitData, lng: number, lat: number, maxM: number): Station | null
export function stationForPlace(data: TransitData, place: { name: string; category: string; lng: number; lat: number }): Station | null
// nearest station within 150 m AND (category matches /station|halt|subway|monorail|platform|stop/i
//   OR normalised place.name contains normalised station.name); else null
export function defaultDir(line: Line, stationId: string): 0 | 1 // direction with more stops after stationId; tie → 0
export function stopIndex(d: Direction, stationId: string): number // -1 if absent
export function linesAt(data: TransitData, stationId: string): Line[] // in data.lines order
```

- [ ] **Step 1: Write failing tests** with a hand-built fixture: two lines, five stations, one interchange `X` on both lines.
  - `stationForPlace` with `{name:'Masjid Jamek LRT', category:'Station', …}` 80 m from station "Masjid Jamek" → that station; the same point with `{name:'Nasi Kandar Pelita', category:'Restaurant'}` → `null`; `{name:'Masjid Jamek', category:'Station'}` 400 m away → `null`.
  - `defaultDir` at the first stop of direction 0 → `0`; at the last stop of direction 0 → `1`.
  - `linesAt(data, 'X')` → both lines; `stopIndex` of an absent station → `-1`.
- [ ] **Step 2:** Run `node --test src/transit/`. Expected: FAIL.
- [ ] **Step 3:** Implement. Name normalisation: lower-case, strip non-letters and the words `lrt|mrt|brt|monorail|station|stesen`.
- [ ] **Step 4:** Run `node --test src/transit/` → PASS; `npm run build` → PASS.
- [ ] **Step 5: Commit** `web: transit lookups (station for search result, default direction)`

---

### Task 4: Map layer + base-map muting

**Files:**
- Modify: `apps/web/src/mapTheme.ts`: `SHOW_RAIL_STATIONS = false` (line 19); add `export function setRailMuted(map: MapLibreMap, muted: boolean): void` that sets `line-opacity` (muted `0.25`, else `1`) on base `transportation` line layers where `roadTier(id) === 'rail'`.
- Create: `apps/web/src/transit/transitLayer.ts`

**Interfaces:**
- Consumes: `TransitData` (`types.ts`), `linesAt`/`stopIndex` (`lookup.ts`), `setRailMuted` (`mapTheme.ts`)
- Produces:

```ts
export function addTransitLayer(map: MapLibreMap, data: TransitData, onStationClick: (stationId: string) => void): TransitLayer
export type TransitLayer = {
  setHighlight(lineId: string | null, dir: 0 | 1): void // draws that direction's shape + stop rings; mutes base rail and off-line dots; null clears both
  setSelectedStation(stationId: string | null): void
  remove(): void // safe if the map is already destroyed (wrap in try/catch like searchLayer)
}
```

Layer stack (insert all below the first `symbol` layer, except stop labels): `transit-line-casing` (white, width ~9), `transit-line` (line colour, width ~6), `transit-dots` (white fill, grey ring; ring = line colour and larger when on the highlighted line; opacity 0.35 when a line is highlighted and the dot is off it; minzoom 12, interchanges radius +1), `transit-selected` (larger ring on the selected station), `transit-labels` (symbol, names of the highlighted line's stops only, minzoom 12). Data-driven paint via feature properties (`onLine`, `selected`, `interchange`, `colour`), updated with `setData`, the same pattern as `searchLayer.ts`.

- [ ] **Step 1:** Make the `mapTheme.ts` change and create `transitLayer.ts`.
- [ ] **Step 2:** `npm run build && npm run lint` → PASS.
- [ ] **Step 3:** `npm run dev`: the base map's station icons are gone, and the map otherwise looks unchanged. (The layer isn't mounted until Task 6; its visuals are checked in Task 7.)
- [ ] **Step 4:** Commit `web: transit map layer (station dots, Google-Maps-style line highlight); hide base station icons`

---

### Task 5: Cards (`StationCard`, `LineCard`, `transit.css`)

**Files:**
- Create: `apps/web/src/transit/StationCard.tsx`, `apps/web/src/transit/LineCard.tsx`, `apps/web/src/transit/transit.css` (imported by both cards)

**Interfaces:**
- Consumes: `schedule.ts` (`stationStatus`, `formatClock`, `firstLast`, `klClock`), `lookup.ts` (`linesAt`, `stopIndex`), `types.ts`
- Produces:

```tsx
<StationCard data={TransitData} stationId={string} now={Date}
  onPickLine={(lineId: string) => void} onClose={() => void} />
<LineCard data={TransitData} lineId={string} dir={0|1} stationId={string} now={Date}
  onPickStop={(stationId: string) => void} onSwapDir={() => void} onBack={() => void} onClose={() => void} />
```

Copy (exact):
- Station meta: categories joined with ` · ` + ` · N lines` (e.g. `LRT · MRT · 3 lines`; singular `1 line`)
- Station line row: `<terminus A> ⇄ <terminus B>` and `every N min` or `Closed · opens HH:MM`
- Line header: `To <headsign>` + swap button `aria-label="Swap direction"`; status `every N min now · last train HH:MM` or `Closed · opens HH:MM`
- Stop rows: current = `you're here`; ahead = `+N min` (rounded `(offset − currentOffset)/60`); behind = dimmed, no time
- A `Scheduled times` caption on both cards

Root element: `<section className="place-card transit-card">`, reusing `place-card__close`/`__name`/`__meta`. Line card stop list: `max-height` so the sheet stays ≤ 55vh on phones, `overflow-y: auto`, and the current row is `scrollIntoView({block:'center'})` on mount and when the station changes.

- [ ] **Step 1:** Implement both cards and the CSS.
- [ ] **Step 2:** `npm run build && npm run lint` → PASS. (Visuals and phone layout are checked in Task 7.)
- [ ] **Step 3:** Commit `web: station and line cards for transit`

---

### Task 6: `useTransit` hook

**Files:**
- Create: `apps/web/src/transit/useTransit.ts` (TSX allowed: `useTransit.tsx` if it returns JSX)

**Interfaces:**
- Consumes: Tasks 1–5. Imports `rapidRail.json` statically.
- Produces:

```ts
export function useTransit(map: MapLibreMap | null, opts: { onOpen: () => void; fitPadding: () => PaddingOptions }): {
  card: ReactNode                                 // StationCard | LineCard | null
  openStationForPlace(place: Place): boolean      // uses stationForPlace; true = handled (opened station)
  close(): void                                   // → none
}
```

State: `TransitSelection` from the spec. Transitions exactly as the spec table. The hook owns the `addTransitLayer` lifecycle (create when `map` is set, `remove()` on cleanup) and keeps the layer in sync via `setHighlight`/`setSelectedStation`. `now` refreshes every 60 s while a card is open. Camera: entering `station` → `easeTo` (zoom `max(current, 14)`); entering `line` → `fitBounds(shape, { padding: opts.fitPadding(), duration: 600 })`; no camera move on stop change or swap. Call `opts.onOpen()` whenever moving from `none` to a card.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** `npm run build && npm run lint` → PASS. (Behaviour is checked in Task 7.)
- [ ] **Step 3:** Commit `web: useTransit hook (selection, layer sync, camera)`

---

### Task 7: Wire into `App.tsx` and verify end to end

**Files:**
- Modify: `apps/web/src/App.tsx`: exactly four additions, each marked `// transit`:
  1. `const transit = useTransit(map, { onOpen: () => setCardOpen(false), fitPadding })`
  2. In the function passed as `SearchBox onSelect`: `if (transit.openStationForPlace(place)) return` before the existing `showPlace` logic (wrap with a small arrow if `onSelect={showPlace}` is passed directly)
  3. Wherever the place card opens (`setCardOpen(true)` inside `showPlace` and the pin click): `transit.close()`
  4. `{transit.card}` rendered next to the `PlaceCard` block

**Interfaces:**
- Consumes: `useTransit` (Task 6); the existing `fitPadding`, `setCardOpen`, `showPlace` in `App.tsx`

- [ ] **Step 1:** `git pull --rebase origin main` first. If driving directions has merged, the four additions go into the new `App.tsx`. Don't touch their code; if their structure makes a hook-up unclear, stop and ask Barath.
- [ ] **Step 2:** Make the four additions. `npm run build && npm run lint` → PASS.
- [ ] **Step 3: Browser checks** (`npm run dev`), from the spec's testing section:
  - Tap Masjid Jamek → a station card listing Ampang, Sri Petaling and Kelana Jaya with `every N min`
  - Tap Kelana Jaya → the line is highlighted end to end, other tracks muted, the camera fits the line; stops listed with `+N min`; `you're here` on Masjid Jamek
  - Swap direction → the terminus label flips and times recompute, camera unchanged; tap another stop in the list → `you're here` moves
  - Tap a dot off the line → that station's card, highlight cleared; ← back → the station card
  - Search "KL Sentral" → the station card, not a place card; search a restaurant → the place card, and the transit card closes
  - × on the transit card → everything clears; × on the place card → its pin stays (existing behaviour)
- [ ] **Step 4 (Review Focus 3):** Devtools at 375 px: the line card is a bottom sheet, scrolls internally, the current stop is centred.
- [ ] **Step 5 (Review Focus 1 & 5):** Toggle the theme with a line open: the highlight, stop rings and muting are unchanged. Hard-reload in dev (StrictMode): the console shows no "source already exists" or `remove()` errors.
- [ ] **Step 6 (Review Focus 2):** Search something with results near a station (e.g. "Pasar Seni") and click where a purple dot overlaps a station dot. Only one card opens. If both fire, make the transit click handler ignore clicks where `map.queryRenderedFeatures(point, { layers: ['search-results-dots'] })` is non-empty.
- [ ] **Step 7:** `node --test scripts/ src/transit/` → PASS. `git diff --stat origin/main` shows only `apps/web/` and `docs/superpowers/` files, and `App.tsx` with a small line count.
- [ ] **Step 8: Commit** `web: hook transit station/line view into the app`
- [ ] **Step 9:** Ask Barath before pushing the branch or opening a PR.

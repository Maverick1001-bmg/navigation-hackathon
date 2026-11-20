# Public Transport on the Map: What It Can Do

As of 2026-11-20 · PR #17

The map now shows Kuala Lumpur's Rapid KL rail network: 8 lines and 159 stations, from the official timetable. Tap a station to see its lines and how often trains come. Tap a line to see the whole route highlighted, with every stop and the minutes to each one. It works with no API key and no extra server, and it's live on main as of PR #17.

## What you can do

| Action | What happens |
| --- | --- |
| Tap a station dot | A station card opens: the station name, LRT/MRT/Monorail/BRT, and one row per line with its two end stations and "every N min" right now. The camera moves to the station. |
| Search for a station (e.g. "Masjid Jamek") | The station card opens instead of a plain place card. Shops, fire stations, bus stops and EV chargers nearby still open the normal place card. |
| Tap a line on the station card | The whole line is highlighted end to end in its official colour, like Google Maps. Its stops become white circles ringed in that colour, with names. Other tracks and stations fade. The camera zooms out to fit the line. |
| Read the line card | Lists every stop in travel order. Your station is marked "you're here". Stops ahead show "+2 min", "+5 min"; stops behind are dimmed. It also shows "every N min now · last train HH:MM". |
| Swap direction (⇄) | Flips to the other terminus and recalculates the times. The camera stays put. |
| Tap another stop (in the list or on the line) | "You're here" moves to that stop and the times recalculate. |
| Tap a station that isn't on the line | Opens that station's card and clears the highlight. |
| ← back / × close | Back returns to the station card. × clears the card and the highlight. |

Interchanges are one station, not several dots. Titiwangsa, for example, shows all 4 of its lines on one card.

## The times, and how far to trust them

Every time is **scheduled**, worked out from the official timetable, and the cards say so. If a train is delayed, the app doesn't know: there is no live train feed for LRT/MRT in Malaysia.

- **How often:** "every N min" comes from the timetable's gaps between trains for that time of day. For example, the Ampang Line runs every 3 min at peak and every 5 min off-peak.
- **Travel times:** "+N min" to each stop ahead comes from the timetable's station-to-station times.
- **First and last train:** worked out per station and per direction. The last train is about one gap before the line's end time.
- **Late night:** trains after midnight still count as the previous day's service until 03:00. At 00:30 on Saturday, the app shows Friday-night trains still running, and shows times like "00:20 (after midnight)".
- **End stations:** only trains leaving the station count. Gombak at 05:30 shows "Closed · opens 06:00". On the line card, an end station says "Last stop in this direction".
- **Closed:** outside service hours the card says "Closed · opens 06:00" instead of a frequency.

It does not give an exact "next train in 2 min". The timetable only gives gaps between trains, so a countdown would be made up.

## Coverage and data

All 8 Rapid KL rail lines are covered: 159 stations, 23 of them interchanges.

| Line | Type | Ends |
| --- | --- | --- |
| Ampang Line | LRT | Sentul Timur ⇄ Ampang |
| Sri Petaling Line | LRT | Sentul Timur ⇄ Putra Heights |
| Kelana Jaya Line | LRT | Gombak ⇄ Putra Heights |
| Shah Alam Line | LRT | Bandar Utama ⇄ Johan Setia |
| Kajang Line | MRT | Kwasa Damansara ⇄ Kajang |
| Putrajaya Line | MRT | Kwasa Damansara ⇄ Putrajaya Sentral |
| KL Monorail | Monorail | KL Sentral ⇄ Titiwangsa |
| Sunway Line | BRT | Sunway-Setia Jaya ⇄ USJ 7 |

The data is the government's open timetable for Rapid KL rail ([data.gov.my GTFS Static API](https://developer.data.gov.my/realtime-api/gtfs-static)). A script converts it once into a 181 KB file that ships with the app (`apps/web/src/transit/rapidRail.json`). The app makes no network calls for transit and needs no API key. It still works if data.gov.my is down. To refresh the data, rerun `apps/web/scripts/build-transit-data.mjs`; the command is at the top of the file.

The timetable's service dates run to 31 December 2026, so the data needs refreshing in the new year.

## How it fits with the rest of the app

- **One card at a time.** Opening a station card hides the place card, but the purple pin and the directions destination stay. Picking a place or tapping its pin closes the transit card.
- **Driving route untouched.** Selecting a station or line never clears a drawn driving route, and the route draws above the rail line.
- **Incidents.** Tapping an incident marker that sits on a station opens only the incident.
- **One set of station dots.** The base map's own station icons are hidden, so every dot you see behaves the same. KTM stations are hidden too for now.
- **Light and dark.** Switching theme keeps the highlight and the faded tracks as they were.
- **Phones.** Under 700 px wide, the cards become a bottom sheet (up to 55% of the screen). The stop list scrolls inside it, and the highlighted line is framed above the sheet. Station dots have a finger-sized tap area.

## Not yet, and what's next

**Can't do yet:**

- **Live positions.** Train times are scheduled only, and there are no live buses yet.
- **Trip planning.** There's no "get me from A to B by train".
- **KTM Komuter.** KTM stations and lines are hidden. The KTM timetable exists but has no track shapes.
- **Reports.** People can't report delays or crowding on a line yet.

**Known rough edges:**

- On phones the transit card covers the report button, notices and the "Set on map" bar while it's open.
- In "Set on map" mode, tapping a station also opens its card.
- Station names and the line's white outline keep their light-mode colours in dark mode.

**Planned next, in order:**

1. Live Rapid KL bus positions on the map, from the government's live feed, updated about every 30 s.
2. Trip planning by bus and rail, using the free Transitous planner. It already returns real KL itineraries.
3. Later: KTM Komuter, then community reports for transit (delays, crowding).

## How to test it

Open the live site, [navigation-hackathon.vercel.app](https://navigation-hackathon.vercel.app), on a laptop and on your phone. Tick each item as you go (on GitHub, edit this file or note problems in the team chat).

- [ ] Zoom in on central KL: white station dots appear, with no second set of station icons.
- [ ] Search "Masjid Jamek" and pick the station result: the station card shows 3 lines (Ampang, Sri Petaling, Kelana Jaya) with "every N min".
- [ ] Tap Kelana Jaya Line: the whole line turns red end to end, other tracks fade, and the map zooms out to fit it.
- [ ] The card shows "you're here" on Masjid Jamek and "+N min" on the stops ahead.
- [ ] Tap ⇄: the direction flips and the times change; the map doesn't move.
- [ ] Tap another stop in the list: "you're here" moves there.
- [ ] Tap ←: you're back on the station card and the highlight is gone.
- [ ] Tap a station dot somewhere else: its card opens.
- [ ] Search a shop or restaurant (e.g. "Pavilion Kuala Lumpur"): the normal place card opens, and Directions still works.
- [ ] Switch light/dark with a line open: the highlight stays.
- [ ] On your phone: the card is a bottom sheet, the stop list scrolls, and the highlighted line is visible above it.
- [ ] Open an end station (e.g. Gombak): the card says "Last stop in this direction" in one direction, and swapping gives departures.

To run it locally instead: `cd apps/web && npm ci && npm run dev`. To run the transit tests: `node --test "scripts/*.test.mjs" "src/transit/*.test.ts"` from `apps/web` (26 tests).

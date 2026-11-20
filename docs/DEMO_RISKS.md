# Demo risks

Things that can break the live demo, and what we do about each. Tick them off as they're handled.
Live site: https://navigation-hackathon.vercel.app (auto-deploys on every merge to `main`).

## Before 3:30 (feature freeze)

- [ ] **Demo data.** Seed 15–20 incidents around KL (jam, flood, roadworks, police) so the map looks alive from the first second.
- [ ] **Phone layout.** Judges will probably open the link on a phone. Check every screen at phone width (Chrome DevTools → device toolbar).
- [ ] **GPS fallback.** Laptop location is often wrong or slow, and the browser asks for permission first. If it's denied the app stays on KL. For the demo, use a fixed start point or a "simulate drive" (e.g. KL Sentral → KLCC) rather than relying on real GPS.
- [ ] **Backend URL.** `VITE_API_URL` is set in Vercel (Project → Settings → Environment Variables), and the deployed site can call the API without CORS errors.
- [ ] **No secrets in the repo.** Keys go in `.env` / Vercel env vars only. CI fails on obvious keys.

## Free services we depend on

All are free with fair-use limits. Don't hammer them while testing.

| What | Service | If it's down or slow |
|---|---|---|
| Map tiles | OpenFreeMap | Map is blank. Backup: Protomaps file for Malaysia. |
| Place search | Photon (photon.komoot.io) | Search shows "unavailable". Search waits 300 ms after typing stops to stay polite. |
| Routing | TBD (Valhalla / hosted API) | No route line. Have a pre-computed demo route ready. |

## Demo day

- [ ] **Venue Wi-Fi.** Everything loads from the internet. Bring a phone hotspot.
- [ ] **Backup video.** Record a 30–60 s screen capture of the full flow the night before.
- [ ] **Freeze.** After 3:30 only bug fixes, and only the Lead merges.
- [ ] **Tag `demo` at 3:45** on `main` and rehearse on exactly that version.
- [ ] **One story.** Search a place → route → incident on the route → reroute / AI summary. Rehearse it twice.

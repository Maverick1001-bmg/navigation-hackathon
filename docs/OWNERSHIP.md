# Who owns what

Fill this in tonight. One owner per area. Agents only edit their owner's area.

| Area | Directory | Owner | Scope |
|---|---|---|---|
| Map & navigation UI | `apps/web/` | _Member A_ | Map view, route display, search box, turn-by-turn panel, report button UI |
| Backend & data | `services/api/` | _Member B_ | API endpoints, incident/hazard reports store, routing/ETA integration, seed data |
| Shared contracts | `packages/shared/`, `docs/CONTRACTS.md` | _Lead_ (change by announcement only) | Types and API shapes used by both sides |
| AI features, integration & demo | `services/ai/` (create it), root config, `.github/` | _Lead_ | AI feature (e.g. report summarising, smart rerouting), wiring, deploy, demo script |

**Lead** = merges to `main` during crunch time, owns root config, runs the final demo build.

## Time plan (4 hours)

| Time | What |
|---|---|
| 0:00–0:20 | Agree on contracts in `docs/CONTRACTS.md`, merge it first. Everyone pulls. |
| 0:20–2:30 | Build in parallel against mocks. Merge to `main` at least every 30–45 min. |
| 2:30 | Integration checkpoint: everyone on latest `main`, real data replaces mocks. |
| 3:30 | **Feature freeze.** Bug fixes and demo polish only. |
| 3:45 | Tag `demo` on `main`. Rehearse on that exact commit. |

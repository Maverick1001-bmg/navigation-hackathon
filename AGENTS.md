# Rules for AI coding agents (Claude Code, Cursor, Copilot, Codex, etc.)

Three humans, each driving one or more AI agents, all committing to the same repo for 4 hours.
The #1 risk is agents stepping on each other. These rules exist to prevent that. Follow them strictly.

## 1. Stay in your lane
- Before editing anything, check `docs/OWNERSHIP.md` and confirm which area your human owns.
- **Only create or modify files inside your human's owned directories.**
- If a change is needed outside your area, STOP and tell your human. Do not "just fix it".
- Never mass-reformat, rename, or move files you don't own. No repo-wide lint `--fix`, no global find-and-replace.

## 2. Shared contracts are frozen-by-default
- `packages/shared/` and `docs/CONTRACTS.md` define the interfaces between the frontend and backend (API routes, request/response shapes, shared types).
- Do NOT change a contract on your own. Additive changes (new optional field, new endpoint) are allowed only after your human announces it in the team chat, and go in their own small PR titled `contract: ...`.
- Never remove or rename a field another area depends on.
- If the contract doesn't support what you need, mock it locally in your own area and flag it.

## 3. Dependencies and config
- Don't add a new dependency without your human's OK. Prefer what's already installed.
- Only one person edits a given `package.json` / lockfile at a time. Root-level config (`package.json`, `tsconfig*`, `.github/`, `.env.example`) is owned by the **Lead** — ask them.
- Never commit secrets. API keys go in `.env` (gitignored); add the variable *name* to `.env.example`.

## 4. Small, frequent, working commits
- Work on a branch named `<name>/<short-feature>` (e.g. `barath/incident-pins`). Never commit directly to `main`.
- Commit in small steps that each leave the app runnable. Message format: `area: what changed` (e.g. `web: add hazard report button`).
- Run `git pull --rebase origin main` before starting a new task and before opening a PR.
- If a rebase hits conflicts in files you don't own, abort (`git rebase --abort`) and tell your human. Don't resolve other people's code.

## 5. Before you say "done"
- The app builds/starts without errors.
- You didn't touch files outside your area (check `git diff --stat origin/main`).
- No debug junk: stray `console.log`, commented-out blocks, TODO placeholders that break the demo.
- No conflict markers (`<<<<<<<`, `>>>>>>>`).

## 6. Keep it hackathon-sized
- Prefer the simplest thing that demos well. Hardcoded seed data and mocks are fine.
- Don't build auth, admin panels, or abstraction layers nobody asked for.
- Don't write long docs or large test suites unless asked. A smoke test is enough.

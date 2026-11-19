# Git workflow: push, pull, merge

Short-lived branches off `main`, squash-merged via PR. `main` must always run.

## Start of every task
```bash
git checkout main
git pull                                  # pull is set to rebase (see one-time setup)
git checkout -b <name>/<feature>          # e.g. aisyah/route-panel
```

## While working
```bash
git add -A && git commit -m "web: add route panel"   # small commits, often
git pull --rebase origin main                         # every ~20 min, keeps you close to main
git push -u origin HEAD                               # push your branch early; backs up your work
```

## Merging (aim for every 30–45 min)
1. `git pull --rebase origin main`, make sure it still runs, then `git push --force-with-lease`.
2. Open a PR: `gh pr create --fill` (or on GitHub).
3. CI must be green. No review required, but **post the PR link in chat** so others know `main` changed.
4. Merge with **Squash and merge**. The branch auto-deletes.
5. Everyone else: `git pull --rebase origin main` when they see the message.

PRs that touch `packages/shared/` or `docs/CONTRACTS.md` need a thumbs-up from the Lead first.

## Rules
- Never push to `main` directly (it's protected).
- Never `git push --force` on `main`. Use `--force-with-lease` only on your own branch.
- Keep each PR inside your area (see `docs/OWNERSHIP.md`). Small PRs merge without conflicts. Big ones don't.
- Conflict in someone else's file? Don't guess. Ask them, or `git rebase --abort` and pair on it.
- After **3:30 (feature freeze)** only the Lead merges, and only fixes.

## Running several AI agents at once on your own laptop
Each agent gets its own worktree so they don't overwrite each other's uncommitted changes:
```bash
git worktree add ../tuju-map-search -b aisyah/map-search
git worktree add ../tuju-route-panel -b aisyah/route-panel
# open one agent in each folder; remove when merged:
git worktree remove ../tuju-map-search
```
Give each agent a task that touches different files.

## One-time setup (each member, tonight)
```bash
git config --global pull.rebase true
git config --global rebase.autoStash true
git config --global push.autoSetupRemote true
gh auth login
git clone https://github.com/<owner>/<repo>.git
```

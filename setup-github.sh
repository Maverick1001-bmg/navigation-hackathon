#!/usr/bin/env bash
# Creates the GitHub repo, pushes this kit, invites collaborators, and protects main.
# Usage:  ./setup-github.sh <repo-name> <collab1> <collab2> [--private]
# Needs:  gh CLI, logged in (`gh auth login`).
set -euo pipefail

REPO="${1:?repo name required}"; C1="${2:?collaborator 1 username}"; C2="${3:?collaborator 2 username}"
VIS="--public"; [[ "${4:-}" == "--private" ]] && VIS="--private"
OWNER="$(gh api user -q .login)"

echo "==> Creating $OWNER/$REPO ($VIS)"
git init -q -b main 2>/dev/null || true
git add -A
git commit -qm "chore: hackathon repo kit (workflow, agent rules, CI)" || true
gh repo create "$OWNER/$REPO" $VIS --source=. --remote=origin --push

echo "==> Merge settings: squash only, auto-delete branches, auto-merge on"
gh repo edit "$OWNER/$REPO" \
  --enable-squash-merge --enable-merge-commit=false --enable-rebase-merge=false \
  --delete-branch-on-merge --enable-auto-merge

echo "==> Inviting collaborators (write access)"
for u in "$C1" "$C2"; do
  gh api -X PUT "repos/$OWNER/$REPO/collaborators/$u" -f permission=push >/dev/null && echo "   invited $u"
done

echo "==> Protecting main: PR required, CI must pass, no force-push"
if gh api -X PUT "repos/$OWNER/$REPO/branches/main/protection" --input - >/dev/null <<'JSON'
{
  "required_status_checks": { "strict": false, "contexts": ["check"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
then echo "   main protected"
else echo "   !! Branch protection failed (private repos on a free personal account don't support it). Make the repo public or just follow the rules."
fi

echo
echo "Done: https://github.com/$OWNER/$REPO"
echo "Tell $C1 and $C2 to accept the invite: https://github.com/$OWNER/$REPO/invitations"

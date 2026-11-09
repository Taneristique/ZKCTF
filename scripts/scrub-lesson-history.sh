#!/usr/bin/env bash
# Rewrite git history so published lesson JSON never contains flag/body (except teaser body).
# After this you must force-push:
#   git push --force-with-lease origin main
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
SEAL="$ROOT/scripts/seal-lessons-tree.mjs"
export FILTER_BRANCH_SQUELCH_WARNING=1

# Clear a previous failed rewrite, if any.
rm -rf .git-rewrite
git for-each-ref --format='delete %(refname)' refs/original 2>/dev/null | git update-ref --stdin 2>/dev/null || true

# tree-filter cwd is each historical tree — call the seal script by absolute path
# so early commits (before the script existed) still scrub lesson JSON.
git filter-branch -f --tree-filter "node '$SEAL'" --tag-name-filter cat -- --all

echo "Local history scrubbed. Review, then: git push --force-with-lease origin main"

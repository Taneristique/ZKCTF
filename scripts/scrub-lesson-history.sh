#!/usr/bin/env bash
# Rewrite git history so published lesson JSON never contains flag/body (except teaser body).
# After this you must force-push (coordinate with anyone else on the repo):
#   git push --force-with-lease origin main
set -euo pipefail
cd "$(dirname "$0")/.."
export FILTER_BRANCH_SQUELCH_WARNING=1
git filter-branch -f --tree-filter 'node scripts/seal-lessons-tree.mjs' --tag-name-filter cat -- --all
echo "Local history scrubbed. Review, then: git push --force-with-lease origin main"

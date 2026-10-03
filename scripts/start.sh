#!/usr/bin/env bash
# Runs the API and the web app in one container; if either exits, the container exits so the host restarts it.
set -euo pipefail
cd "$(dirname "$0")/.."

trap 'kill $(jobs -p) 2>/dev/null' EXIT

# Must match the /zk-api rewrite default in frontend/next.config.ts.
(cd backend && PORT=8787 exec node src/index.js) &
(cd frontend && exec node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-3001}") &

wait -n
exit 1

#!/usr/bin/env bash
# Runs the API and the web app in one container; if either exits, the container exits so the host restarts it.
set -euo pipefail
cd "$(dirname "$0")/.."

trap 'kill $(jobs -p) 2>/dev/null' EXIT

# Durable state lives on the Railway volume (ZKCTF_DATA_DIR=/data).
DATA_DIR="${ZKCTF_DATA_DIR:-/data}"
mkdir -p "$DATA_DIR" 2>/dev/null || true
export ZKCTF_DATA_DIR="$DATA_DIR"
# Restore round.json when the volume lost it (no curl/nano needed on Railway).
node scripts/ensure-round.mjs || echo "[start] ensure-round failed (continuing)"

# Must match the /zk-api rewrite default in frontend/next.config.ts.
(cd backend && PORT=8787 exec node src/index.js) &
(cd frontend && exec node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-3001}") &

wait -n
exit 1

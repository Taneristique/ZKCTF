#!/usr/bin/env bash
# Runs the API and the web app in one container; if either exits, the container exits so the host restarts it.
set -euo pipefail
cd "$(dirname "$0")/.."

trap 'kill $(jobs -p) 2>/dev/null' EXIT

# Durable state must live on a Railway volume at /data.
DATA_DIR="${ZKCTF_DATA_DIR:-/data}"
mkdir -p "$DATA_DIR" 2>/dev/null || true
export ZKCTF_DATA_DIR="$DATA_DIR"
if [[ -z "${RAILWAY_VOLUME_MOUNT_PATH:-}" ]]; then
  echo "[start] CRITICAL: RAILWAY_VOLUME_MOUNT_PATH unset — /data is ephemeral; attach a volume at /data (no trailing space) or every redeploy wipes profiles."
fi
# Reputation durability on the volume: restore backups → merge fixtures → snapshot again.
node scripts/backup-reputation.mjs || echo "[start] backup-reputation failed (continuing)"
node scripts/ensure-round.mjs || echo "[start] ensure-round failed (continuing)"
node scripts/ensure-state.mjs || echo "[start] ensure-state failed (continuing)"
node scripts/backup-reputation.mjs || echo "[start] backup-reputation (post-ensure) failed (continuing)"

# Must match the /zk-api rewrite default in frontend/next.config.ts.
(cd backend && PORT=8787 exec node src/index.js) &
(cd frontend && exec node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-3001}") &

wait -n
exit 1

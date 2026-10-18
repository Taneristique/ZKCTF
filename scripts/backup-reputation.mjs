/**
 * Volume reputation durability:
 *   1) Snapshot non-empty reputation JSON into $ZKCTF_DATA_DIR/backups/<iso>/
 *   2) If a live file is empty/missing but a backup has data, restore it
 *   3) Keep the newest BACKUP_KEEP snapshots
 *
 * Reputation = profiles, prestige, solves, week placements, entries, lessons, loyalty, founders.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = (process.env.ZKCTF_DATA_DIR || join(ROOT, "backend/data")).trim();
const BACKUP_ROOT = join(dataDir, "backups");
const KEEP = Math.max(3, Number(process.env.REPUTATION_BACKUP_KEEP ?? 14));

const FILES = [
  "profiles.json",
  "prestige.json",
  "solves.json",
  "week-nfts.json",
  "entries.json",
  "lesson-solves.json",
  "loyalty.json",
  "founders.json",
  "academy-gifts.json",
  "prize-claims.json",
];

function isUseful(name, raw) {
  if (!raw || !String(raw).trim()) return false;
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!obj || typeof obj !== "object") return false;
  if (name === "profiles.json") return Object.keys(obj.byWallet ?? {}).length > 0;
  return Object.keys(obj).length > 0;
}

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function atomicWrite(path, text) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

mkdirSync(dataDir, { recursive: true });
mkdirSync(BACKUP_ROOT, { recursive: true });

// --- backup current useful files ---
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dest = join(BACKUP_ROOT, stamp);
let backed = 0;
for (const name of FILES) {
  const raw = read(join(dataDir, name));
  if (!isUseful(name, raw)) continue;
  if (!backed) mkdirSync(dest, { recursive: true });
  writeFileSync(join(dest, name), raw);
  backed++;
}
if (backed) console.log(`[backup-reputation] snapshot ${backed} file(s) → ${dest}`);
else console.log("[backup-reputation] nothing useful to snapshot");

// --- restore empty live files from newest backup that has them ---
const snaps = existsSync(BACKUP_ROOT)
  ? readdirSync(BACKUP_ROOT)
      .filter((d) => {
        try {
          return statSync(join(BACKUP_ROOT, d)).isDirectory();
        } catch {
          return false;
        }
      })
      .sort()
      .reverse()
  : [];

let restored = 0;
for (const name of FILES) {
  const livePath = join(dataDir, name);
  if (isUseful(name, read(livePath))) continue;
  for (const snap of snaps) {
    const cand = join(BACKUP_ROOT, snap, name);
    const raw = read(cand);
    if (!isUseful(name, raw)) continue;
    atomicWrite(livePath, raw);
    restored++;
    console.log(`[backup-reputation] restored ${name} ← backups/${snap}/`);
    break;
  }
}
if (!restored) console.log("[backup-reputation] live files ok (no restore needed)");

// --- prune old snapshots ---
if (snaps.length > KEEP) {
  for (const old of snaps.slice(KEEP)) {
    rmSync(join(BACKUP_ROOT, old), { recursive: true, force: true });
    console.log(`[backup-reputation] pruned backups/${old}`);
  }
}

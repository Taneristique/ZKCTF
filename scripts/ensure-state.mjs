/**
 * Merge rescue fixtures into ZKCTF_DATA_DIR when wallets/files are missing.
 * Never overwrites an existing profile/entry/solve row for a wallet.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = (process.env.ZKCTF_DATA_DIR || join(ROOT, "backend/data")).trim();
mkdirSync(dataDir, { recursive: true });

const fixturePath = join(ROOT, "scripts/fixtures/state-2026-10-17-rescue.json");
if (!existsSync(fixturePath)) {
  console.log("[ensure-state] no fixture");
  process.exit(0);
}

const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

function load(name) {
  const p = join(dataDir, name);
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function save(name, obj) {
  const p = join(dataDir, name);
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2));
  renameSync(tmp, p);
}

let restored = 0;

// profiles
{
  const cur = load("profiles.json") ?? { byWallet: {}, byName: {} };
  cur.byWallet ??= {};
  cur.byName ??= {};
  for (const [wallet, row] of Object.entries(fixture.profiles?.byWallet ?? {})) {
    if (cur.byWallet[wallet]) continue;
    cur.byWallet[wallet] = row;
    const key = String(row.pseudonym ?? "").toLowerCase();
    if (key && !cur.byName[key]) cur.byName[key] = wallet;
    restored++;
    console.log(`[ensure-state] restored profile ${row.pseudonym}`);
  }
  if (restored) save("profiles.json", cur);
}

// entries (fill missing wallet only)
{
  let n = 0;
  const cur = load("entries.json") ?? {};
  for (const [wallet, row] of Object.entries(fixture.entries ?? {})) {
    if (cur[wallet]) continue;
    cur[wallet] = row;
    n++;
    console.log(`[ensure-state] restored entry ${wallet.slice(0, 4)}…`);
  }
  if (n) {
    save("entries.json", cur);
    restored += n;
  }
}

// solves
{
  let n = 0;
  const cur = load("solves.json") ?? {};
  for (const [key, row] of Object.entries(fixture.solves ?? {})) {
    if (cur[key]?.levels && Object.keys(cur[key].levels).length) continue;
    cur[key] = row;
    n++;
    console.log(`[ensure-state] restored solves ${row.wallet?.slice(0, 4)}…`);
  }
  if (n) {
    save("solves.json", cur);
    restored += n;
  }
}

// prestige
{
  let n = 0;
  const cur = load("prestige.json") ?? {};
  for (const [wallet, row] of Object.entries(fixture.prestige ?? {})) {
    if (cur[wallet]?.seasons && Object.keys(cur[wallet].seasons).length) continue;
    cur[wallet] = row;
    n++;
    console.log(`[ensure-state] restored prestige ${wallet.slice(0, 4)}…`);
  }
  if (n) {
    save("prestige.json", cur);
    restored += n;
  }
}

if (!restored) console.log("[ensure-state] ok (nothing to merge)");
else console.log(`[ensure-state] merged ${restored} item(s) → ${dataDir}`);

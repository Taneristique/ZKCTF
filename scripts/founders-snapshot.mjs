#!/usr/bin/env node
/**
 * Export the Founding members list (first 100 buyers) from chain into a snapshot file.
 * Point the mainnet backend's FOUNDER_SNAPSHOT at it so these wallets get the Founding price there.
 *
 *   cd backend && node ../scripts/founders-snapshot.mjs [out.json]   # default ../snapshots/founders-<cluster>.json
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND = join(ROOT, "backend");
const require = createRequire(join(BACKEND, "package.json"));
try {
  require("dotenv").config({ path: join(BACKEND, ".env") });
} catch {
  /* optional */
}

const load = (rel) => import(pathToFileURL(join(BACKEND, "src", rel)).href);

async function main() {
  process.chdir(BACKEND);
  const { Connection } = await import("@solana/web3.js");
  const { syncFounders, founders } = await load("founders.js");
  const { FOUNDING } = await load("membership.js");
  const { CLUSTER } = await load("race.js");
  const connection = new Connection(process.env.SOLANA_RPC ?? "https://api.devnet.solana.com", "confirmed");
  const sync = await syncFounders(connection);
  const rows = founders()
    .filter((r) => r.ordinal <= FOUNDING.seats)
    .map(({ ordinal, wallet, signature, paidAt }) => ({ ordinal, wallet, signature, paidAt: new Date(paidAt).toISOString() }));
  const out = process.argv[2] ?? join(ROOT, "snapshots", `founders-${CLUSTER}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(rows, null, 2)}\n`);
  console.log(`${rows.length} founders (${sync.added} new from chain) → ${out}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);

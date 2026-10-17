/**
 * Rescue a live round after /data/round.json was lost:
 *   1. Write official seed puzzles for the current Saturday window into round.json
 *   2. create_round with the same start/end (program refreshes commitments only)
 *
 * Requires: upgraded program (same-window commitment refresh), AUTHORITY_KEYPAIR*, BOT-like RPC.
 *
 *   node scripts/rescue-round.mjs              # write + publish
 *   node scripts/rescue-round.mjs --write-only # only write round.json (copy to Railway /data)
 */
import { createRequire } from "module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(ROOT, "backend/package.json"));
try {
  require("dotenv").config({ path: join(ROOT, "backend/.env") });
} catch {
  /* optional */
}

const writeOnly = process.argv.includes("--write-only");

const { Connection } = require("@solana/web3.js");
const { authorityKeypair } = await import(join(ROOT, "backend/src/authority.js"));
const { onChainRound, createRoundIx, sendAndConfirm } = await import(join(ROOT, "backend/src/chain.js"));
const { saturdayWindow } = await import(join(ROOT, "backend/src/race.js"));
const { OFFICIAL } = await import(join(ROOT, "backend/src/seeds.js"));
const { writeRound, readRound, roundCommitments } = await import(join(ROOT, "backend/src/roundStore.js"));
const { Transaction } = require("@solana/web3.js");

const { start, end } = saturdayWindow();
const row = writeRound({
  start: start.toISOString(),
  end: end.toISOString(),
  levels: OFFICIAL,
  source: "rescue-seeds",
});
console.log(`wrote round.json ${row.start} → ${row.end} (${row.levels.length} levels, ${row.source})`);
for (const lv of row.levels) console.log(`  L${lv.id} ${lv.h.slice(0, 16)}…  ${lv.flag}`);

if (writeOnly) {
  console.log("\n--write-only: copy this file to Railway /data/round.json, then re-run without --write-only after program upgrade.");
  const path = process.env.ZKCTF_DATA_DIR
    ? join(process.env.ZKCTF_DATA_DIR, "round.json")
    : join(ROOT, "backend/data/round.json");
  console.log(`local path: ${path}`);
  process.exit(0);
}

const rpc = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const connection = new Connection(rpc, "confirmed");
const authority = authorityKeypair();
const chain = await onChainRound(connection);
if (!chain) throw new Error("no on-chain round");
const startS = Math.floor(Date.parse(row.start) / 1000);
const endS = Math.floor(Date.parse(row.end) / 1000);
if (chain.start !== startS || chain.end !== endS) {
  throw new Error(
    `window mismatch: chain ${new Date(chain.start * 1000).toISOString()}..${new Date(chain.end * 1000).toISOString()} vs host ${row.start}..${row.end}`,
  );
}
console.log(`chain entries=${chain.entries} pot=${chain.potAtoms} — commitments will refresh, pot kept`);

const tx = new Transaction().add(
  createRoundIx({
    payer: authority.publicKey.toBase58(),
    authority: authority.publicKey.toBase58(),
    start: startS,
    end: endS,
    levelCount: row.levels.length,
    commitments: roundCommitments(),
  }),
);
const sig = await sendAndConfirm(connection, tx, [authority]);
console.log(`create_round (commitment refresh) ok: ${sig}`);

const after = await onChainRound(connection);
const host = readRound().levels.map((l) => l.h);
for (let i = 0; i < row.levels.length; i++) {
  const ok = after.commitments[i] === host[i];
  console.log(`  L${i} chain==host ${ok}`);
  if (!ok) process.exitCode = 1;
}
console.log("\nNext: put the same round.json on Railway at $ZKCTF_DATA_DIR/round.json and redeploy/restart the API.");

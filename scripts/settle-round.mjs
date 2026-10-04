#!/usr/bin/env node
/**
 * Manually settle the on-chain round after it ends (the API scheduler does this automatically).
 * Winners are read from chain only: Entry PDAs of this round whose solved_mask covers every level,
 * fastest first. Missing winner/treasury USDC accounts are created first, paid by the authority.
 *
 *   cd backend && node ../scripts/settle-round.mjs
 */
import { createRequire } from "node:module";
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
  const { Connection } = require("@solana/web3.js");
  const { authorityKeypair } = await load("authority.js");
  const { onChainRound } = await load("chain.js");
  const { settleOnChain } = await load("scheduler.js");
  const connection = new Connection(process.env.SOLANA_RPC ?? "https://api.devnet.solana.com", "confirmed");
  const round = await onChainRound(connection);
  if (!round) throw new Error("no on-chain round");
  if (round.settled) return console.log("already settled");
  if (Date.now() / 1000 <= round.end) throw new Error(`round ends ${new Date(round.end * 1000).toISOString()}`);
  const out = await settleOnChain({ connection, authority: authorityKeypair(), round });
  console.log(`settled: ${out.winners.length} winner(s), tx ${out.sig}`);
  out.winners.forEach((w, i) => console.log(`  #${i + 1} ${w}`));
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);

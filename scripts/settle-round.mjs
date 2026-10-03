#!/usr/bin/env node
/**
 * Settle the weekly USDC pot after the window ends.
 * Lock A: winners = on-chain Entry.solved_mask set by Groth16 submit only (not off-chain solves.json).
 * Run: cd backend && TREASURY_USDC_ATA=... node ../scripts/settle-round.mjs
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

async function loadBackend(rel) {
  return import(pathToFileURL(join(BACKEND, "src", rel)).href);
}

function windowStartIso() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 15, 0, 0, 0));
  const daysSinceSat = (start.getUTCDay() + 1) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceSat);
  return start.toISOString();
}

async function main() {
  process.chdir(BACKEND);
  const treasuryAta = process.env.TREASURY_USDC_ATA;
  if (!treasuryAta) throw new Error("Set TREASURY_USDC_ATA");
  const { Connection } = await import("@solana/web3.js");
  const { listEntries } = await loadBackend("store.js");
  const { publicLevels } = await loadBackend("roundStore.js");
  const { authorityKeypair } = await loadBackend("authority.js");
  const { settleIx, recentTx, ata, rankClearsOnChain } = await loadBackend("chain.js");
  const { N_WINNERS } = await loadBackend("race.js");

  const RPC = process.env.SOLANA_RPC ?? "https://api.devnet.solana.com";
  const connection = new Connection(RPC, "confirmed");
  const authority = authorityKeypair();
  const startIso = windowStartIso();
  const levelCount = publicLevels().length;
  const candidates = listEntries(startIso).map((e) => e.wallet);
  const ranked = await rankClearsOnChain(connection, candidates, levelCount);
  const winners = ranked.slice(0, N_WINNERS);
  const k = winners.length;
  const winnerAtas = winners.map((w) => ata(w.wallet).toBase58());
  console.log(
    `Settling k=${k} (on-chain full clears only, ${levelCount} levels, ${candidates.length} entry candidates)`,
    winners.map((w) => `${w.wallet.slice(0, 4)}… t=${w.time}`),
  );
  const ix = settleIx({
    authority: authority.publicKey.toBase58(),
    treasuryAta,
    winnerAtas,
    k,
  });
  const tx = await recentTx(connection, authority.publicKey);
  tx.add(ix);
  tx.partialSign(authority);
  const sig = await connection.sendRawTransaction(tx.serialize());
  console.log("settle tx", sig);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

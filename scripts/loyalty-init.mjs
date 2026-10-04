#!/usr/bin/env node
/**
 * One-time: create the soulbound Finisher loyalty mint (Token-2022, NonTransferable, decimals 0,
 * on-chain metadata). The authority key pays (~0.004 SOL) and becomes mint + metadata authority.
 * Put the printed address in LOYALTY_MINT on the server.
 *
 *   cd backend && node ../scripts/loyalty-init.mjs
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
  if (process.env.LOYALTY_MINT) throw new Error(`LOYALTY_MINT is already set (${process.env.LOYALTY_MINT}).`);
  const { Connection } = require("@solana/web3.js");
  const { authorityKeypair } = await load("authority.js");
  const { createLoyaltyMint } = await load("loyalty.js");
  const connection = new Connection(process.env.SOLANA_RPC ?? "https://api.devnet.solana.com", "confirmed");
  const base = (process.env.PUBLIC_APP_URL ?? "https://zkctf.com").replace(/\/$/, "");
  const out = await createLoyaltyMint(connection, authorityKeypair(), {
    name: "ZKCTF Finisher",
    symbol: "ZKFIN",
    uri: `${base}/loyalty.json`,
  });
  console.log(`LOYALTY_MINT=${out.mint}\ntx ${out.signature}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);

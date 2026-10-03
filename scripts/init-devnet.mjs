#!/usr/bin/env node
/**
 * One-time devnet bootstrap after `solana program deploy`:
 *   1) initialize (config PDA, authority = AUTHORITY_KEYPAIR)
 *   2) create_round from backend/data/round.json (start = now unless ROUND_START_FROM_FILE=1)
 * Pot vault USDC ATA is created separately with spl-token (see README).
 *
 * Run: cd backend && node ../scripts/init-devnet.mjs
 */
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND = join(ROOT, "backend");
const require = createRequire(join(BACKEND, "package.json"));
require("dotenv").config({ path: join(BACKEND, ".env") });

const load = (rel) => import(pathToFileURL(join(BACKEND, "src", rel)).href);

const { Connection, SystemProgram, TransactionInstruction } = require("@solana/web3.js");
const { authorityKeypair } = await load("authority.js");
const { PROGRAM_ID, configPda, roundPda, potVaultPda, potAta, disc, createRoundIx, recentTx } =
  await load("chain.js");
const { readRound, roundCommitments } = await load("roundStore.js");

const RPC = process.env.SOLANA_RPC ?? "https://api.devnet.solana.com";
const connection = new Connection(RPC, "confirmed");
const authority = authorityKeypair();

async function send(ix, label) {
  const tx = await recentTx(connection, authority.publicKey);
  tx.add(ix);
  tx.sign(authority);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");
  console.log(`${label}: ${sig}`);
}

console.log(`program=${PROGRAM_ID.toBase58()} authority=${authority.publicKey.toBase58()}`);

const [config] = configPda();
if (await connection.getAccountInfo(config)) {
  console.log(`initialize: config ${config.toBase58()} already exists, skipping`);
} else {
  await send(
    new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: authority.publicKey, isSigner: true, isWritable: false },
        { pubkey: config, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: disc("initialize"),
    }),
    "initialize",
  );
}

const row = readRound();
const end = Math.floor(new Date(row.end).getTime() / 1000);
const start =
  process.env.ROUND_START_FROM_FILE === "1"
    ? Math.floor(new Date(row.start).getTime() / 1000)
    : Math.floor(Date.now() / 1000) - 60;
await send(
  createRoundIx({
    payer: authority.publicKey.toBase58(),
    authority: authority.publicKey.toBase58(),
    start,
    end,
    levelCount: row.levels.length,
    commitments: roundCommitments(),
  }),
  `create_round ${new Date(start * 1000).toISOString()} → ${row.end}`,
);

const [vault] = potVaultPda();
const pot = potAta();
const potInfo = await connection.getAccountInfo(pot);
console.log(`round=${roundPda()[0].toBase58()}`);
console.log(`pot vault=${vault.toBase58()} pot ATA=${pot.toBase58()} ${potInfo ? "exists" : "MISSING"}`);
if (!potInfo) {
  console.log(`Create it: spl-token create-account ${process.env.USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"} --owner ${vault.toBase58()} --fee-payer <keypair> -u devnet`);
}

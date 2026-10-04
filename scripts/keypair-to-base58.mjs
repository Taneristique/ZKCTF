#!/usr/bin/env node
/**
 * Print a solana-keygen keypair file as a single base58 secret, the easiest form to paste into a
 * hosting dashboard (AUTHORITY_KEYPAIR_JSON accepts it). The output is a secret: run it only in your
 * own terminal and never commit or share it.
 *
 *   node scripts/keypair-to-base58.mjs ~/.config/solana/zkctf-devnet.json
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND = join(dirname(fileURLToPath(import.meta.url)), "..", "backend");
const { Keypair } = createRequire(join(BACKEND, "package.json"))("@solana/web3.js");

const path = process.argv[2];
if (!path) throw new Error("usage: node scripts/keypair-to-base58.mjs <keypair.json>");
const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
let x = BigInt(`0x${Buffer.from(kp.secretKey).toString("hex")}`);
let out = "";
while (x > 0n) {
  out = A[Number(x % 58n)] + out;
  x /= 58n;
}
for (const b of kp.secretKey) {
  if (b !== 0) break;
  out = `1${out}`;
}
console.error(`public key: ${kp.publicKey.toBase58()}`);
console.log(out);

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Keypair } from "@solana/web3.js";

/** Local demo authority. Production: AUTHORITY_KEYPAIR=path to json. */
export function authorityKeypair() {
  if (process.env.AUTHORITY_KEYPAIR) {
    const raw = JSON.parse(readFileSync(process.env.AUTHORITY_KEYPAIR, "utf8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }
  const seed = createHash("sha256").update("zkctf-colosseum-authority-v3").digest();
  return Keypair.fromSeed(seed);
}

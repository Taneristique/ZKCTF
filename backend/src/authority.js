import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Keypair } from "@solana/web3.js";

/** Where the authority key comes from: "env-json" | "file" | "demo". */
export function authoritySource() {
  if (process.env.AUTHORITY_KEYPAIR_JSON) return "env-json";
  if (process.env.AUTHORITY_KEYPAIR) return "file";
  return "demo";
}

/**
 * Production: AUTHORITY_KEYPAIR_JSON=[...64 bytes] (hosted secret) or AUTHORITY_KEYPAIR=path to json.
 * The demo key comes from a public seed and never matches a real on-chain config,
 * so the API refuses to co-sign with it (see authorityStatus in index.js).
 */
export function authorityKeypair() {
  const inline = process.env.AUTHORITY_KEYPAIR_JSON;
  if (inline) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(inline)));
  }
  if (process.env.AUTHORITY_KEYPAIR) {
    const raw = JSON.parse(readFileSync(process.env.AUTHORITY_KEYPAIR, "utf8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }
  const seed = createHash("sha256").update("zkctf-colosseum-authority-v3").digest();
  return Keypair.fromSeed(seed);
}

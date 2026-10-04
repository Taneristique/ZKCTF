import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Keypair } from "@solana/web3.js";

/** Where the authority key comes from: "env-json" | "file" | "demo". */
export function authoritySource() {
  if (process.env.AUTHORITY_KEYPAIR_JSON) return "env-json";
  if (process.env.AUTHORITY_KEYPAIR) return "file";
  return "demo";
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Decode(s) {
  let x = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) throw new Error("not base58");
    x = x * 58n + BigInt(i);
  }
  const bytes = [];
  while (x > 0n) {
    bytes.unshift(Number(x & 0xffn));
    x >>= 8n;
  }
  for (const c of s) {
    if (c !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

/**
 * Accepts the solana-keygen file content ([12,34,…]), the same numbers without brackets, or the
 * base58 secret key wallets export. Tolerates surrounding quotes and whitespace that hosting
 * dashboards add. Errors never include the value.
 */
export function parseSecretKey(raw) {
  const s = String(raw).trim().replace(/^['"]|['"]$/g, "").trim();
  let bytes;
  if (/^[\d\s,[\]]+$/.test(s)) bytes = Uint8Array.from(s.replace(/[[\]\s]/g, "").split(",").filter(Boolean).map(Number));
  else bytes = base58Decode(s);
  if (bytes.length !== 64 || bytes.some((b) => !(b >= 0 && b <= 255))) {
    throw new Error(`authority secret must be 64 bytes, got ${bytes.length}`);
  }
  return Keypair.fromSecretKey(bytes);
}

/**
 * Production: AUTHORITY_KEYPAIR_JSON (hosted secret, any format parseSecretKey accepts) or
 * AUTHORITY_KEYPAIR=path to a solana-keygen json file. The demo key comes from a public seed and never
 * matches a real on-chain config, so the API refuses to co-sign with it (see authorityStatus in index.js).
 */
export function authorityKeypair() {
  const inline = process.env.AUTHORITY_KEYPAIR_JSON;
  if (inline) {
    try {
      return parseSecretKey(inline);
    } catch (e) {
      throw new Error(`AUTHORITY_KEYPAIR_JSON is not a valid Solana secret key (${e.message}).`);
    }
  }
  if (process.env.AUTHORITY_KEYPAIR) {
    return parseSecretKey(readFileSync(process.env.AUTHORITY_KEYPAIR, "utf8"));
  }
  const seed = createHash("sha256").update("zkctf-colosseum-authority-v3").digest();
  return Keypair.fromSeed(seed);
}

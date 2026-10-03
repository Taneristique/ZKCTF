/**
 * Wallet sign-in for member-only routes. The client signs a short message with its Solana wallet
 * (ed25519); the signature is a bearer token until `expires`.
 *
 * Headers: x-zkctf-wallet, x-zkctf-message (base64 UTF-8), x-zkctf-signature (base64, 64 bytes).
 */
import { createPublicKey, verify } from "node:crypto";
import { PublicKey } from "@solana/web3.js";

const PREFIX = "ZKCTF Academy sign-in";
const MAX_TTL_MS = 7 * 24 * 3600_000;
// DER SubjectPublicKeyInfo header for a raw 32-byte Ed25519 key.
const ED25519_SPKI = Buffer.from("302a300506032b6570032100", "hex");

export function authMessage(wallet, expires) {
  return `${PREFIX}\nwallet: ${wallet}\nexpires: ${new Date(expires).toISOString()}`;
}

function ed25519Verify(pubkey32, message, signature) {
  const key = createPublicKey({ key: Buffer.concat([ED25519_SPKI, pubkey32]), format: "der", type: "spki" });
  return verify(null, message, key, signature);
}

/** Returns the authenticated wallet (base58) or null. */
export function walletFromRequest(req, now = Date.now()) {
  const wallet = req.get("x-zkctf-wallet");
  const msgB64 = req.get("x-zkctf-message");
  const sigB64 = req.get("x-zkctf-signature");
  if (!wallet || !msgB64 || !sigB64) return null;
  try {
    const pubkey = new PublicKey(wallet);
    const message = Buffer.from(msgB64, "base64");
    const signature = Buffer.from(sigB64, "base64");
    if (signature.length !== 64) return null;
    const text = message.toString("utf8");
    const m = /^ZKCTF Academy sign-in\nwallet: (\S+)\nexpires: (\S+)$/.exec(text);
    if (!m || m[1] !== pubkey.toBase58()) return null;
    const expires = Date.parse(m[2]);
    if (!Number.isFinite(expires) || expires <= now || expires - now > MAX_TTL_MS) return null;
    if (!ed25519Verify(pubkey.toBuffer(), message, signature)) return null;
    return pubkey.toBase58();
  } catch {
    return null;
  }
}

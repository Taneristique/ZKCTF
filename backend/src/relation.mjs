import { keccak_256 } from "@noble/hashes/sha3.js";

export const FLAG_LEN = 32;

export function utf8(s) {
  return new TextEncoder().encode(s);
}

export function pad32(bytesOrStr) {
  const b = typeof bytesOrStr === "string" ? utf8(bytesOrStr) : Uint8Array.from(bytesOrStr);
  if (b.length > FLAG_LEN) throw new Error("value longer than 32 bytes");
  const out = new Uint8Array(FLAG_LEN);
  out.set(b);
  return out;
}

export function concat(...parts) {
  const n = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function keccak(bytes) {
  return keccak_256(bytes);
}

export function flagsEqual(a, b) {
  const x = pad32(a);
  const y = pad32(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

export function createCommitment(flag, delta) {
  const s = pad32(flag);
  const d = pad32(delta);
  return { s, delta: d, h: keccak(concat(s, d)) };
}

export function playerCommitment(pubkey32, flag, nonce) {
  const s = pad32(flag);
  const n = pad32(nonce);
  const P = Uint8Array.from(pubkey32);
  if (P.length !== 32) throw new Error("P must be 32 bytes");
  return { s, nonce: n, P, C: keccak(concat(P, s, n)) };
}

export function hex32(buf) {
  return Buffer.from(buf).toString("hex");
}

export function fromHex(h) {
  return Uint8Array.from(Buffer.from(h, "hex"));
}

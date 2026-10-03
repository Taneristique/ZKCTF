import { keccak_256 } from "@noble/hashes/sha3.js";

export const FLAG_LEN = 32;

export function utf8(s) {
  return new TextEncoder().encode(s);
}

/** Flag / salt → 32 bytes, zero-padded. Rejects overflow. */
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

/** 32-byte hash/pubkey → two 16-byte big-endian field strings (dec). */
export function limbs32(buf) {
  const hi = buf.slice(0, 16);
  const lo = buf.slice(16, 32);
  return { hi: beToDec(hi), lo: beToDec(lo) };
}

export function beToDec(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) + BigInt(b);
  return n.toString();
}

export function hex32(buf) {
  return Buffer.from(buf).toString("hex");
}

export function circuitInput({ s, delta, nonce, P, h, C }) {
  const hL = limbs32(h);
  const cL = limbs32(C);
  const pL = limbs32(P);
  return {
    s: Array.from(s),
    delta: Array.from(delta),
    nonce: Array.from(nonce),
    pBytes: Array.from(P),
    hHi: hL.hi,
    hLo: hL.lo,
    cHi: cL.hi,
    cLo: cL.lo,
    pHi: pL.hi,
    pLo: pL.lo,
  };
}

export function publicSignals({ h, C, P }) {
  const hL = limbs32(h);
  const cL = limbs32(C);
  const pL = limbs32(P);
  return [hL.hi, hL.lo, cL.hi, cL.lo, pL.hi, pL.lo];
}

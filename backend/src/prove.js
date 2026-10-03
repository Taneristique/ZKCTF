import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createCommitment, playerCommitment, fromHex, hex32 } from "./relation.mjs";

const circuitRoot =
  process.env.ZKCTF_CIRCUITS_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "../../circuits");

export function artifactsReady() {
  return (
    existsSync(join(circuitRoot, "build/relation.zkey")) &&
    existsSync(join(circuitRoot, "build/relation_js/relation.wasm"))
  );
}

export async function groth16Proof({ flag, deltaHex, nonceHex, pubkey32 }) {
  const { proveRelation } = await import(
    join(circuitRoot, "scripts/prove.mjs")
  );
  return proveRelation({
    flag,
    delta: Buffer.from(deltaHex, "hex"),
    nonce: Buffer.from(nonceHex, "hex"),
    pubkey32,
  });
}

export function checkFlag(level, flag) {
  const { s, h } = createCommitment(flag, fromHex(level.delta));
  return hex32(h) === level.h ? { s, h } : null;
}

export function buildC(pubkey32, flag, nonce) {
  return playerCommitment(pubkey32, flag, nonce);
}

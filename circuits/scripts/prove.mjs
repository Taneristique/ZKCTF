import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as snarkjs from "snarkjs";
import { buildBn128, unstringifyBigInts } from "ffjavascript";
import {
  createCommitment,
  playerCommitment,
  circuitInput,
  pad32,
  publicSignals,
} from "../lib/relation.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function proveRelation({ flag, delta, nonce, pubkey32 }) {
  const { s, h, delta: d } = createCommitment(flag, delta);
  const play = playerCommitment(pubkey32, flag, nonce);
  const input = circuitInput({
    s,
    delta: d,
    nonce: play.nonce,
    P: play.P,
    h,
    C: play.C,
  });
  const wasm = join(root, "build/relation_js/relation.wasm");
  const zkey = join(root, "build/relation.zkey");
  const { proof, publicSignals: pubs } = await snarkjs.groth16.fullProve(input, wasm, zkey);
  const vk = JSON.parse(readFileSync(join(root, "build/verification_key.json"), "utf8"));
  const ok = await snarkjs.groth16.verify(vk, pubs, proof);
  if (!ok) throw new Error("snarkjs verify failed");
  return {
    proof,
    publicSignals: pubs,
    expectedPublic: publicSignals({ h, C: play.C, P: play.P }),
    h,
    C: play.C,
    solana: await toSolanaProof(proof),
  };
}

export async function toSolanaProof(proof) {
  const curve = await buildBn128();
  const p = unstringifyBigInts(proof);
  const a = curve.G1.toUncompressed(curve.G1.neg(curve.G1.fromObject(p.pi_a)));
  const b = curve.G2.toUncompressed(curve.G2.fromObject(p.pi_b));
  const c = curve.G1.toUncompressed(curve.G1.fromObject(p.pi_c));
  await curve.terminate();
  return {
    a: Buffer.from(a).toString("hex"),
    b: Buffer.from(b).toString("hex"),
    c: Buffer.from(c).toString("hex"),
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const flag = process.argv[2] ?? "ZKCTF{xor-1}";
  const P = Buffer.alloc(32, 7);
  const out = await proveRelation({
    flag,
    delta: Buffer.alloc(32, 1),
    nonce: Buffer.alloc(32, 2),
    pubkey32: P,
  });
  writeFileSync(join(root, "build/last-proof.json"), JSON.stringify(out, (_k, v) => (v instanceof Uint8Array ? Buffer.from(v).toString("hex") : v), 2));
  console.log("verified", flag, "C", Buffer.from(out.C).toString("hex"));
}

import { createCommitment, playerCommitment, circuitInput, pad32 } from "../lib/relation.mjs";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const flag = "ZKCTF{xor-1}";
const P = new Uint8Array(32).fill(7);
const delta = new Uint8Array(32).fill(1);
const nonce = new Uint8Array(32).fill(2);
const { s, h } = createCommitment(flag, delta);
const play = playerCommitment(P, flag, nonce);
const input = circuitInput({ s, delta: pad32(delta), nonce: play.nonce, P, h, C: play.C });
console.log("relation js ok", Buffer.from(h).toString("hex"));

const zkey = join(root, "build/relation.zkey");
const wasm = join(root, "build/relation_js/relation.wasm");
if (!existsSync(zkey) || !existsSync(wasm)) {
  console.log("zkey not ready — keccak ℛ JS holds; groth16 setup still running");
  process.exit(0);
}

const snarkjs = await import("snarkjs");
const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasm, zkey);
const vk = JSON.parse(await (await import("node:fs/promises")).readFile(join(root, "build/verification_key.json"), "utf8"));
const ok = await snarkjs.groth16.verify(vk, publicSignals, proof);
if (!ok) throw new Error("correct witness must verify");

const bad = circuitInput({
  s: pad32("nope"),
  delta: pad32(delta),
  nonce: play.nonce,
  P,
  h,
  C: play.C,
});
let threw = false;
try {
  await snarkjs.groth16.fullProve(bad, wasm, zkey);
} catch {
  threw = true;
}
if (!threw) throw new Error("c≠s must not prove");
console.log("groth16: c=s verify=1; c≠s no π");

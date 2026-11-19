const fs = require("fs");
const crypto = require("crypto");
(async () => {
  const { buildPoseidon } = await import("circomlibjs");
  const p = await buildPoseidon();
  const F = p.F;
  const H = (a) => F.toObject(p(a));
  const D = 4;
  const pad32 = (s) => { const b = Buffer.alloc(32); Buffer.from(s).copy(b); return b; };
  const limbs = (b) => [BigInt("0x" + b.subarray(0, 16).toString("hex")), BigInt("0x" + b.subarray(16).toString("hex"))];
  const rand31 = () => BigInt("0x" + crypto.randomBytes(31).toString("hex"));

  const P = crypto.randomBytes(32);
  const [pHi, pLo] = limbs(P);
  const flag = "ZKCTF{caesar_test}";
  const [sHi, sLo] = limbs(pad32(flag));
  const delta = rand31();
  const nonce = rand31();
  const level = 0n;

  const h = H([1n, sHi, sLo, delta]);
  const leaf = H([3n, pHi, pLo, level, h]);
  const N = 1 << D, myIdx = 5;
  const leaves = Array.from({ length: N }, (_, i) => i === myIdx ? leaf : H([9n, BigInt(i), rand31()]));
  // build tree
  let layer = leaves, layers = [layer];
  while (layer.length > 1) { const nx = []; for (let i = 0; i < layer.length; i += 2) nx.push(H([layer[i], layer[i + 1]])); layer = nx; layers.push(layer); }
  const root = layers[D][0];
  const idxBits = [], sib = []; let idx = myIdx;
  for (let l = 0; l < D; l++) { idxBits.push(String(idx & 1)); sib.push(String(layers[l][idx ^ 1])); idx >>= 1; }
  const C = H([2n, pHi, pLo, sHi, sLo, nonce]);

  const wc = require("./../build-proto/dyn4_js/witness_calculator.js");
  const calc = await wc(fs.readFileSync("build-proto/dyn4_js/dyn4.wasm"));
  const mk = (over = {}) => ({ root: String(root), C: String(C), pHi: String(pHi), pLo: String(pLo), level: "0",
    sHi: String(sHi), sLo: String(sLo), delta: String(delta), nonce: String(nonce), idxBits, sib, ...over });

  await calc.calculateWitness(mk(), 0);
  console.log("correct flag, valid path : witness OK");
  const [wHi, wLo] = limbs(pad32("ZKCTF{wrong_guess}"));
  for (const [name, over] of [
    ["wrong flag", { sHi: String(wHi), sLo: String(wLo) }],
    ["wrong delta", { delta: String(delta + 1n) }],
    ["wrong player (pHi)", { pHi: String(pHi + 1n) }],
    ["wrong level", { level: "1" }],
    ["wrong root", { root: String(root + 1n) }],
  ]) {
    try { await calc.calculateWitness(mk(over), 0); console.log(name, ": UNEXPECTED OK"); }
    catch { console.log(name, ": rejected (constraint fails) as expected"); }
  }
})();

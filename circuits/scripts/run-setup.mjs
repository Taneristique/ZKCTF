import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as snarkjs from "snarkjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const r1cs = join(root, "build/relation.r1cs");
const ptau = join(root, "build/pot19_final.ptau");
const z0 = join(root, "build/relation_0000.zkey");
const zkey = join(root, "build/relation.zkey");
const vkey = join(root, "build/verification_key.json");

const logger = {
  info: (...a) => console.log(new Date().toISOString(), ...a),
  warn: (...a) => console.warn(new Date().toISOString(), ...a),
  error: (...a) => console.error(new Date().toISOString(), ...a),
  debug: () => {},
};

if (!existsSync(r1cs) || !existsSync(ptau)) {
  throw new Error("need build/relation.r1cs and build/pot19_final.ptau");
}

if (!existsSync(z0)) {
  console.log("== zkey new ==");
  await snarkjs.zKey.newZKey(r1cs, ptau, z0, logger);
}

if (!existsSync(zkey)) {
  console.log("== beacon (local ceremony) ==");
  await snarkjs.zKey.beacon(z0, zkey, "zkctf", "a1b2c3d4e5f60789", 10, logger);
}

console.log("== export vk ==");
const vk = await snarkjs.zKey.exportVerificationKey(zkey);
await import("node:fs/promises").then((fs) =>
  fs.writeFile(vkey, JSON.stringify(vk, null, 2)),
);
console.log("SETUP_OK", zkey);

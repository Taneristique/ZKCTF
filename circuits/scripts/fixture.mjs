// Writes a real Groth16 proof (Solana byte layout) for the program's verify_groth16 unit test.
//   node scripts/fixture.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { proveRelation } from "./prove.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pubkey32 = Buffer.alloc(32, 7);
const out = await proveRelation({
  flag: "ZKCTF{xor-1}",
  delta: Buffer.alloc(32, 1),
  nonce: Buffer.alloc(32, 2),
  pubkey32,
});
const hex = (b) => Buffer.from(b).toString("hex");
const lines = [out.solana.a, out.solana.b, out.solana.c, hex(out.h), hex(out.C), hex(pubkey32)];
const file = join(root, "../programs/zkctf/tests/fixtures/groth16.txt");
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, lines.join("\n") + "\n");
console.log("wrote", file);
process.exit(0);

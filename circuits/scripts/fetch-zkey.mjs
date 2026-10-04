// Downloads the proving key into build/ and checks its sha256. Missing or mismatched => no file (groth16 stays off).
//   ZKCTF_ZKEY_URL=... ZKCTF_ZKEY_SHA256=... node scripts/fetch-zkey.mjs
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.ZKCTF_ZKEY_URL;
const want = process.env.ZKCTF_ZKEY_SHA256;
const out = join(root, "build/relation.zkey");

if (!url || !want) {
  console.log("zkey: no ZKCTF_ZKEY_URL / ZKCTF_ZKEY_SHA256, groth16 off");
  process.exit(0);
}
try {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = createHash("sha256").update(buf).digest("hex");
  if (got !== want) throw new Error(`sha256 mismatch ${got}`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buf);
  console.log("zkey: ok", buf.length, "bytes");
} catch (e) {
  console.log("zkey: unavailable, groth16 off:", e.message);
  // A soft failure would be cached as a Docker layer and silently reused by every later build.
  if (process.env.ZKCTF_ZKEY_REQUIRED === "1") process.exit(1);
}

#!/usr/bin/env node
/**
 * Publish ZKCTF IDL (+ optional security.txt) via Program Metadata (PMP).
 *
 * Mental model (EVM → Solana):
 *   ABI file          → idl/zkctf.json
 *   verify+publish    → this script (writes on-chain metadata PDA)
 *   Etherscan "Read"  → explorer / idl.solana.com reads that PDA
 *
 * YOU must sign as the program UPGRADE AUTHORITY (often the same key as
 * on-chain Config.authority). Without that key, use --non-canonical.
 *
 * Usage:
 *   node scripts/publish-idl.mjs --convert-only
 *   node scripts/publish-idl.mjs --upload --keypair ~/.config/solana/id.json --rpc https://api.devnet.solana.com
 *   node scripts/publish-idl.mjs --upload --security --keypair ./authority.json --rpc https://api.devnet.solana.com
 *
 * Verify:
 *   curl "https://idl-one.vercel.app/api/idl?programId=34Kut3tQ4HTJMF2gVvnT6shhmenPE6463xnGk5sxDtz7&cluster=devnet"
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROGRAM_ID = "34Kut3tQ4HTJMF2gVvnT6shhmenPE6463xnGk5sxDtz7";
const ANCHOR_IDL = join(ROOT, "idl/zkctf.json");
const CODAMA_IDL = join(ROOT, "idl/zkctf.codama.json");
const SECURITY = join(ROOT, "idl/security.json");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};

function convertToCodama() {
  const require = createRequire(import.meta.url);
  let rootNodeFromAnchor;
  try {
    ({ rootNodeFromAnchor } = require("@codama/nodes-from-anchor"));
  } catch {
    if (existsSync(CODAMA_IDL)) {
      console.warn("[idl] @codama/nodes-from-anchor missing — using committed idl/zkctf.codama.json");
      return CODAMA_IDL;
    }
    console.error("Missing @codama/nodes-from-anchor. From repo root run:");
    console.error("  npm i -D @codama/nodes-from-anchor");
    process.exit(1);
  }
  const anchor = JSON.parse(readFileSync(ANCHOR_IDL, "utf8"));
  const root = rootNodeFromAnchor(anchor);
  mkdirSync(dirname(CODAMA_IDL), { recursive: true });
  writeFileSync(CODAMA_IDL, JSON.stringify(root, null, 2));
  console.log(`[idl] wrote Codama → ${CODAMA_IDL}`);
  return CODAMA_IDL;
}

function publish(file, seed, { keypair, rpc, nonCanonical }) {
  const cmd = [
    "npx",
    "--yes",
    "@solana-program/program-metadata@latest",
    "write",
    seed,
    PROGRAM_ID,
    file,
    "--rpc",
    rpc,
  ];
  if (keypair) cmd.push("--keypair", keypair);
  if (nonCanonical) cmd.push("--non-canonical");
  console.log(`[idl] $ ${cmd.join(" ")}`);
  execFileSync(cmd[0], cmd.slice(1), { stdio: "inherit", cwd: ROOT });
}

if (!existsSync(ANCHOR_IDL)) {
  console.error(`missing ${ANCHOR_IDL}`);
  process.exit(1);
}

const convertOnly = flag("--convert-only");
const upload = flag("--upload");
const withSecurity = flag("--security");
const keypair = opt("--keypair", null);
const rpc = opt("--rpc", "https://api.devnet.solana.com");
const nonCanonical = flag("--non-canonical");

const codamaPath = convertToCodama();

if (convertOnly || !upload) {
  console.log(`
Next (you run — needs program UPGRADE AUTHORITY keypair):

  node scripts/publish-idl.mjs --upload \\
    --keypair /path/to/upgrade-authority.json \\
    --rpc https://api.devnet.solana.com

Optional security.txt:
  node scripts/publish-idl.mjs --upload --security \\
    --keypair /path/to/upgrade-authority.json

If you are NOT upgrade authority (third-party IDL):
  add --non-canonical

Check:
  curl "https://idl-one.vercel.app/api/idl?programId=${PROGRAM_ID}&cluster=devnet"
`);
  if (!upload) process.exit(0);
}

publish(codamaPath, "idl", { keypair, rpc, nonCanonical });
if (withSecurity) {
  if (!existsSync(SECURITY)) {
    console.error(`missing ${SECURITY}`);
    process.exit(1);
  }
  publish(SECURITY, "security", { keypair, rpc, nonCanonical });
}

console.log(`[idl] done. Fetch:
  npx @solana-program/program-metadata@latest fetch idl ${PROGRAM_ID} --rpc ${rpc}
`);

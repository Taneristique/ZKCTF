#!/usr/bin/env node
/** API path: $5 entry + flag + optional custom seat. */
const API = process.env.API ?? "http://127.0.0.1:8787";
const wallet = process.env.JUDGE_WALLET ?? "34Kut3tQ4HTJMF2gVvnT6shhmenPE6463xnGk5sxDtz7";

async function j(path, opts) {
  const res = await fetch(API + path, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status} ${text}`);
  return JSON.parse(text);
}

const health = await j("/health");
if (health.product !== "ZKCTF") throw new Error("not the same product");
if (health.entryUsdc !== 5 || health.nWinners !== 10 || health.treasuryBps !== 2000) {
  throw new Error("race constants");
}

const entered = await j("/enter", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ wallet }),
});
if (!entered.entered) throw new Error("entry missing");

const row = await j(`/entry/${wallet}`);
if (!row.entered) throw new Error("entry not live");

const wrong = await fetch(API + "/prove-assist", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ wallet, level: 0, c: "nope" }),
});
if (wrong.status !== 403) throw new Error("wrong flag must 403");

const assist = await j("/prove-assist", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ wallet, level: 0, c: "ZKCTF{xor-1}", prove: true }),
});
if (!assist.ok || !assist.C || !assist.delta) throw new Error("prove-assist failed");

const checkout = await j("/checkout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sku: "std-1", wallet, origin: "http://192.168.0.15:3001" }),
});
if (!checkout.demo) throw new Error("expected custom demo seat");

// Fresh studio quota for this judge run (open slots count unfinished units).
const { writeFileSync, readFileSync, mkdirSync } = await import("node:fs");
const { dirname, join } = await import("node:path");
const { fileURLToPath } = await import("node:url");
const dataDir = process.env.ZKCTF_DATA_DIR
  ? process.env.ZKCTF_DATA_DIR
  : join(dirname(fileURLToPath(import.meta.url)), "../backend/data");
mkdirSync(dataDir, { recursive: true });
for (const name of ["custom.json", "enroll.json"]) {
  const path = join(dataDir, name);
  let all = {};
  try {
    all = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    all = {};
  }
  delete all[wallet];
  writeFileSync(path, JSON.stringify(all, null, 2));
}

const enroll = await j("/custom/enroll", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ wallet, track: "security", category: "web2", mode: "lesson" }),
});
if (!enroll.enrollment?.category) throw new Error("enroll missing");

const custom = await j("/custom/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ wallet, track: "security", category: "web2", mode: "lesson" }),
});
if (!custom.unit?.lesson?.body || !custom.unit?.exercise?.statement) throw new Error("studio unit missing");
if (!enroll.enrollment?.syllabus?.length) throw new Error("syllabus missing");
if (custom.enrollment?.syllabus?.some((s) => s.done)) {
  throw new Error("syllabus must stay locked until flag validate");
}

const stored = JSON.parse(readFileSync(join(dataDir, "custom.json"), "utf8"));
const rawUnit = (stored[wallet] ?? []).find((u) => u.id === custom.unit.id);
if (!rawUnit?.flag) throw new Error("stored unit flag missing");

const bad = await fetch(`${API}/custom/validate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ wallet, unitId: custom.unit.id, flag: "ZKCTF{wrong}" }),
});
if (bad.status !== 400) throw new Error("wrong flag should fail");

const cleared = await j("/custom/validate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ wallet, unitId: custom.unit.id, flag: rawUnit.flag }),
});
if (!cleared.ok || !cleared.enrollment?.syllabus?.some((s) => s.done)) {
  throw new Error("syllabus step not marked after validate");
}
if (!cleared.unit?.done) throw new Error("unit not marked done");

console.log(
  JSON.stringify(
    {
      ok: true,
      product: "ZKCTF",
      wallet,
      entryUsdc: health.entryUsdc,
      treasuryBps: health.treasuryBps,
      nWinners: health.nWinners,
      C: assist.C,
      groth16: Boolean(assist.proof),
      custom: `${custom.unit.track}/${custom.unit.category}`,
      step: custom.unit.stepTitle,
      syllabus: enroll.enrollment.syllabus.length,
      customGate: "generate→validate",
      faucet: "https://faucet.solana.com",
    },
    null,
    2,
  ),
);

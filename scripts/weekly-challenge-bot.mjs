#!/usr/bin/env node
/**
 * Weekly challenge bot.
 *
 * 1) Builds a new official set (seed rotation, or OpenRouter if OPENROUTER_API_KEY set)
 * 2) Writes answers + commitments to backend/data/round.json
 * 3) Optionally pushes create_round on-chain (CHAIN_DEPLOY=1)
 *
 * Run from repo root OR backend (Node resolves deps from backend/):
 *   cd backend && node ../scripts/weekly-challenge-bot.mjs
 *   node ../scripts/weekly-challenge-bot.mjs --dry-run   # generate + check, print, write nothing
 *   CHAIN_DEPLOY=1 node ../scripts/weekly-challenge-bot.mjs
 *
 * AI levels are kept only if they pass validateLevel() and an independent solve
 * attempt returns the same flag (BOT_VERIFY=0 skips the solve check). Missing
 * slots are filled from seeds.
 */
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND = join(ROOT, "backend");
const require = createRequire(join(BACKEND, "package.json"));
try {
  require("dotenv").config({ path: join(BACKEND, ".env") });
} catch {
  /* optional */
}

async function loadBackend(rel) {
  return import(pathToFileURL(join(BACKEND, "src", rel)).href);
}

function thisSaturdayWindow() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 15, 0, 0, 0));
  const daysSinceSat = (start.getUTCDay() + 1) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceSat);
  let end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  if (now >= end) {
    start.setUTCDate(start.getUTCDate() + 7);
    end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  }
  return { start, end };
}

const DRY_RUN = process.argv.includes("--dry-run");
const LEVEL_COUNT = 4;
/** Circuit packs the flag into 32 bytes (relation.mjs pad32). */
const FLAG_RE = /^ZKCTF\{[a-z0-9_-]{1,25}\}$/;

async function openrouter(messages, maxTokens) {
  const key = process.env.OPENROUTER_API_KEY;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.PUBLIC_APP_URL ?? "https://zkctf.local",
      "X-Title": "ZKCTF",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4",
      max_tokens: maxTokens,
      messages,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let msg = body.slice(0, 300);
    try {
      msg = JSON.parse(body)?.error?.message ?? msg;
    } catch {
      /* keep raw */
    }
    const tip =
      res.status === 401
        ? " (key rejected — needs an OpenRouter key from openrouter.ai/keys, not an Anthropic key)"
        : res.status === 402
          ? " (no OpenRouter credits)"
          : "";
    throw new Error(`openrouter ${res.status}: ${msg}${tip}`);
  }
  const data = await res.json();
  return String(data?.choices?.[0]?.message?.content ?? "");
}

function parseJsonObject(text) {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no JSON object in reply");
  return JSON.parse(text.slice(a, b + 1));
}

const str = (v, min, max) => typeof v === "string" && v.trim().length >= min && v.trim().length <= max;

/** Returns a list of problems; empty ⇒ usable. */
function validateLevel(lv) {
  const out = [];
  if (!str(lv?.title, 3, 80)) out.push("title must be 3–80 chars");
  if (!str(lv?.statement, 40, 1500)) out.push("statement must be 40–1500 chars");
  if (!str(lv?.walkthrough, 20, 2000)) out.push("walkthrough must be 20–2000 chars");
  if (!Array.isArray(lv?.hints) || lv.hints.length < 1 || lv.hints.length > 3 || !lv.hints.every((h) => str(h, 5, 300)))
    out.push("need 1–3 hints of 5–300 chars");
  if (lv?.artifacts != null && (!Array.isArray(lv.artifacts) || !lv.artifacts.every((a) => typeof a === "string")))
    out.push("artifacts must be strings");
  const flag = String(lv?.flag ?? "");
  if (!FLAG_RE.test(flag) || Buffer.byteLength(flag) > 32) out.push(`flag "${flag}" must match ZKCTF{[a-z0-9_-]{1,25}}`);
  const visible = [lv?.statement, ...(lv?.artifacts ?? []), ...(lv?.hints ?? [])].join("\n").toLowerCase();
  const body = flag.slice(6, -1).toLowerCase();
  if (body.length >= 4 && visible.includes(body)) out.push("flag text leaks in statement/artifacts/hints");
  if (visible.includes(flag.toLowerCase())) out.push("full flag appears in player-visible text");
  if (/https?:\/\//i.test(visible)) out.push("must be self-contained (no URLs)");
  return out;
}

async function solveIndependently(lv) {
  const reply = await openrouter(
    [
      {
        role: "user",
        content: `Solve this CTF puzzle. Reply with only the flag in the form ZKCTF{...}, nothing else.

Title: ${lv.title}
${lv.statement}
${(lv.artifacts ?? []).length ? `Artifacts:\n${lv.artifacts.join("\n")}` : ""}`,
      },
    ],
    400,
  );
  return reply.match(/ZKCTF\{[^}\s]*\}/)?.[0] ?? reply.trim();
}

async function aiLevels() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.log("OPENROUTER_API_KEY not set in backend/.env → seed rotation.");
    return null;
  }
  if (!key.startsWith("sk-or-")) {
    console.warn("OPENROUTER_API_KEY does not look like an OpenRouter key (sk-or-…). Anthropic console keys do not work here.");
  }
  const prompt = `Write exactly ${LEVEL_COUNT} beginner-friendly CTF puzzles for a 24-hour Saturday race, easiest first.
Mix: at least one number-theory / modular-arithmetic puzzle, one encoding puzzle (hex, base64, XOR, Caesar), and one smart-contract or web security concept puzzle.

Every puzzle must:
- be fully self-contained: all data needed is in "statement" or "artifacts"; no URLs, files, or external services
- have exactly one correct answer that a careful beginner can derive by hand or with a basic calculator in under 20 minutes
- use a flag of the form ZKCTF{answer} where answer is lowercase [a-z0-9_-], at most 25 characters
- never reveal the answer in statement, artifacts, or hints
- have "walkthrough" show the full derivation step by step so a reviewer can check the answer
- avoid real people, real companies, live targets, working exploit code, or malware

Reply with JSON only:
{"levels":[{"title":"","statement":"","artifacts":[],"hints":["",""],"flag":"ZKCTF{...}","walkthrough":""}]}`;

  const verify = process.env.BOT_VERIFY !== "0";
  const kept = [];
  const flags = new Set();
  for (let attempt = 1; attempt <= 2 && kept.length < LEVEL_COUNT; attempt++) {
    const json = parseJsonObject(await openrouter([{ role: "user", content: prompt }], 4000));
    const levels = Array.isArray(json.levels) ? json.levels : [];
    for (const lv of levels) {
      if (kept.length >= LEVEL_COUNT) break;
      const problems = validateLevel(lv);
      if (flags.has(lv?.flag)) problems.push("duplicate flag");
      if (!problems.length && verify) {
        const got = await solveIndependently(lv);
        if (got !== lv.flag) problems.push(`independent solve gave ${got}, expected ${lv.flag}`);
      }
      if (problems.length) {
        console.warn(`  rejected "${lv?.title ?? "?"}": ${problems.join("; ")}`);
        continue;
      }
      flags.add(lv.flag);
      kept.push({
        title: lv.title.trim(),
        statement: lv.statement.trim(),
        artifacts: lv.artifacts ?? [],
        hints: lv.hints.map((h) => h.trim()),
        walkthrough: lv.walkthrough.trim(),
        flag: lv.flag,
      });
    }
  }
  return kept;
}

async function main() {
  process.chdir(BACKEND);
  const { OFFICIAL } = await loadBackend("seeds.js");
  const { writeRound, roundCommitments, readRound } = await loadBackend("roundStore.js");

  const { start, end } = thisSaturdayWindow();
  let ai = [];
  try {
    ai = (await aiLevels()) ?? [];
  } catch (e) {
    console.warn("AI generate failed, using seed rotate:", e.message);
  }
  const levels = [...ai];
  const week = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
  const used = new Set(levels.map((l) => l.flag));
  for (let i = 0; levels.length < LEVEL_COUNT && i < OFFICIAL.length; i++) {
    const src = OFFICIAL[(week + i) % OFFICIAL.length];
    if (used.has(src.flag)) continue;
    used.add(src.flag);
    levels.push({
      title: src.title,
      statement: src.statement,
      artifacts: src.artifacts,
      hints: src.hints,
      walkthrough: src.walkthrough,
      flag: src.flag,
    });
  }
  levels.forEach((lv, i) => (lv.id = i));
  const source = ai.length === 0 ? "seed-rotate" : ai.length < levels.length ? "openrouter+seed" : "openrouter";

  if (DRY_RUN) {
    console.log(`DRY RUN — ${levels.length} levels (${source}); backend/data/round.json not changed.\n`);
    for (const lv of levels) {
      console.log(`── L${lv.id} ${lv.title}  flag=${lv.flag}`);
      console.log(lv.statement);
      if (lv.artifacts?.length) console.log(`Artifacts:\n${lv.artifacts.join("\n")}`);
      console.log(`Hints: ${lv.hints.join(" | ")}`);
      console.log(`Walkthrough: ${lv.walkthrough}\n`);
    }
    return;
  }

  const row = writeRound({
    start: start.toISOString(),
    end: end.toISOString(),
    levels,
    source,
  });
  console.log(`Wrote ${row.levels.length} levels → backend/data/round.json (${source})`);
  console.log(`Window ${row.start} → ${row.end}`);
  for (const lv of row.levels) {
    console.log(`  L${lv.id} ${lv.title}  flag=${lv.flag}  h=${lv.h.slice(0, 16)}…`);
  }

  if (process.env.CHAIN_DEPLOY !== "1") {
    console.log("Skip on-chain create_round (set CHAIN_DEPLOY=1 to push).");
    console.log("Hint: cd backend && node ../scripts/weekly-challenge-bot.mjs");
    return;
  }

  const { Connection } = await import(pathToFileURL(join(BACKEND, "node_modules/@solana/web3.js/lib/index.cjs")).href).catch(
    () => import("@solana/web3.js"),
  );
  const { authorityKeypair } = await loadBackend("authority.js");
  const { createRoundIx, recentTx, PROGRAM_ID } = await loadBackend("chain.js");
  const RPC = process.env.SOLANA_RPC ?? "https://api.devnet.solana.com";
  const connection = new Connection(RPC, "confirmed");
  const authority = authorityKeypair();
  const commitments = roundCommitments();
  const ix = createRoundIx({
    payer: authority.publicKey.toBase58(),
    authority: authority.publicKey.toBase58(),
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
    levelCount: row.levels.length,
    commitments,
  });
  const tx = await recentTx(connection, authority.publicKey);
  tx.add(ix);
  tx.partialSign(authority);
  const sig = await connection.sendRawTransaction(tx.serialize());
  console.log(`create_round tx ${sig} program=${PROGRAM_ID.toBase58()}`);
  console.log("Current host round:", readRound().source);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

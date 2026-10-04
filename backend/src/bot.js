/**
 * Builds next week's round: procedural levels from ctfgen.js, optionally with a short AI-written
 * story intro grounded in the level's reference doc. The intro is rejected unless it is plain prose
 * (no digits, URLs or answer text) and the level still re-solves to the same flag afterwards.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRound, checkLevel } from "./ctfgen.js";

const DOCS = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../content/ctf-docs/index.json"), "utf8"),
);

export function docFor(id) {
  const d = DOCS[id];
  return d ? { id, title: d.title, refs: d.refs } : null;
}

async function openrouter(prompt) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(45_000),
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.PUBLIC_APP_URL ?? "https://zkctf.com",
      "X-Title": "ZKCTF",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`openrouter ${res.status}`);
  const data = await res.json();
  return String(data?.choices?.[0]?.message?.content ?? "").trim();
}

function introProblems(intro, lv) {
  const out = [];
  if (intro.length < 40 || intro.length > 350) out.push("length");
  if (/\d/.test(intro)) out.push("digits");
  if (/https?:\/\/|ZKCTF|[{}`]/i.test(intro)) out.push("url/flag/markup");
  if (intro.toLowerCase().includes(lv.flag.slice(6, -1).toLowerCase())) out.push("answer");
  return out;
}

async function withIntro(lv) {
  const doc = DOCS[lv.doc];
  const intro = (
    await openrouter(`Write a 2-sentence scenario that sets the scene for a beginner CTF puzzle about "${doc.title}".
Background (stay consistent with it): ${doc.summary}
Real incident for tone: ${doc.incidents[0]}
Rules: plain prose only, no numbers or digits, no code, no URLs, do not describe how to solve it, do not invent data. Reply with the two sentences only.`)
  ).replace(/^["']|["']$/g, "");
  const problems = introProblems(intro, lv);
  if (problems.length) throw new Error(`intro rejected (${problems.join(", ")})`);
  const next = { ...lv, statement: `${intro} ${lv.statement}` };
  const recheck = checkLevel(lv.type, next);
  if (recheck.length) throw new Error(`intro broke level: ${recheck.join("; ")}`);
  return next;
}

/** Never throws for AI problems: any failed intro just keeps the procedural statement. */
export async function generateRound({ count = 4, avoid = [], ai = Boolean(process.env.OPENROUTER_API_KEY), log = console.log } = {}) {
  let levels = buildRound({ count, avoid });
  let source = "procedural";
  if (ai && process.env.BOT_AI !== "0") {
    let used = 0;
    levels = await Promise.all(
      levels.map((lv) =>
        withIntro(lv).then(
          (next) => (used++, next),
          (e) => {
            log(`  L${lv.id} ${lv.type}: keeping plain statement (${e.message})`);
            return lv;
          },
        ),
      ),
    );
    if (used) source = "procedural+ai";
  }
  for (const lv of levels) {
    const problems = checkLevel(lv.type, lv);
    if (problems.length) throw new Error(`L${lv.id} ${lv.type}: ${problems.join("; ")}`);
  }
  return { levels, source };
}

#!/usr/bin/env node
/**
 * Weekly Academy lessons: AI drafts, a human edits and publishes.
 *
 *   node scripts/lesson.mjs draft --track security --case "Wormhole 2022" [--topic "account validation"]
 *   node scripts/lesson.mjs draft --track math --topic "ECDSA nonce reuse" --blank
 *   node scripts/lesson.mjs check  backend/content/lessons/drafts/<file>.json
 *   node scripts/lesson.mjs publish backend/content/lessons/drafts/<file>.json --editor "Your Name" [--at 2026-10-10T12:00:00Z]
 *   node scripts/lesson.mjs list
 *
 * Drafts are never served. Only `publish` (after your review) moves a lesson to backend/content/lessons/published/.
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND = join(ROOT, "backend");
const require = createRequire(join(BACKEND, "package.json"));
try {
  require("dotenv").config({ path: join(BACKEND, ".env") });
} catch {
  /* optional */
}

const LESSONS = join(BACKEND, "content/lessons");
const DRAFTS = join(LESSONS, "drafts");
const PUBLISHED = join(LESSONS, "published");
const TRACKS = ["security", "math"];
const FLAG_RE = /^ZKCTF\{[A-Za-z0-9_\-]{1,48}\}$/;

const [cmd, ...rest] = process.argv.slice(2);
const args = {};
const positional = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) {
    const k = rest[i].slice(2);
    const v = rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : true;
    args[k] = v;
  } else positional.push(rest[i]);
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

const str = (v, min, max) => typeof v === "string" && v.trim().length >= min && v.trim().length <= max;

function problems(l) {
  const out = [];
  if (!TRACKS.includes(l.track)) out.push(`track must be one of ${TRACKS.join(", ")}`);
  if (!str(l.title, 5, 100)) out.push("title: 5–100 chars");
  if (!str(l.summary, 40, 400)) out.push("summary: 40–400 chars");
  if (!str(l.body, 800, 12000)) out.push("body: 800–12000 chars (a real lesson, not a blurb)");
  if (l.track === "security" && !(l.case?.name && l.case?.date)) out.push("security lessons need case.name + case.date (real incident)");
  if (l.case && (!Array.isArray(l.case.sources) || l.case.sources.length === 0))
    out.push("case.sources: at least one link you have checked");
  if (!str(l.exercise?.statement, 40, 1500)) out.push("exercise.statement: 40–1500 chars");
  if (!Array.isArray(l.exercise?.hints) || l.exercise.hints.length < 1) out.push("exercise.hints: at least one");
  if (!FLAG_RE.test(String(l.flag ?? ""))) out.push("flag must look like ZKCTF{...} (letters, digits, _ or -)");
  if (/TODO/.test(JSON.stringify(l))) out.push("remove every TODO before publishing");
  return out;
}

function template({ track, topic, caseName }) {
  const now = new Date();
  return {
    id: "",
    week: isoWeek(now),
    track,
    title: topic ? `TODO title about ${topic}` : "TODO title",
    summary: "TODO 1–2 sentences: what happened / what the learner can do after this lesson.",
    case: track === "security" || caseName
      ? { name: caseName ?? "TODO incident name", date: "TODO YYYY-MM-DD", impact: "TODO", sources: ["TODO link"] }
      : null,
    body: "TODO lesson body. Plain paragraphs separated by blank lines.",
    exercise: { statement: "TODO", artifacts: [], hints: ["TODO"] },
    flag: "ZKCTF{TODO}",
    authors: { ai: null, human: null },
    reviewed: false,
    status: "draft",
    publishedAt: null,
  };
}

async function openrouter(messages) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.PUBLIC_APP_URL ?? "https://zkctf.local",
      "X-Title": "ZKCTF",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4",
      max_tokens: 6000,
      messages,
    }),
  });
  if (!res.ok) {
    const tip = res.status === 401 ? " (needs an OpenRouter key from openrouter.ai/keys)" : "";
    throw new Error(`openrouter ${res.status}: ${(await res.text()).slice(0, 300)}${tip}`);
  }
  const data = await res.json();
  const text = String(data?.choices?.[0]?.message?.content ?? "");
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("model reply had no JSON object");
  return JSON.parse(text.slice(a, b + 1));
}

function prompt({ track, topic, caseName }) {
  const focus =
    track === "security"
      ? `Cybersecurity lesson that reproduces a REAL, publicly documented incident${caseName ? `: ${caseName}` : ""}${topic ? ` (theme: ${topic})` : ""}.
Explain the system, the exact flaw, how it was exploited at a conceptual level, the fix, and the general bug class. Then a reproduction exercise: a small simplified code/config/log artifact that contains the same flaw, with one unambiguous answer.`
      : `Math-for-cybersecurity lesson${topic ? ` on: ${topic}` : ""}${caseName ? `, motivated by the real incident ${caseName}` : ""}.
Teach the math from first principles with one worked example, connect it to where it breaks or protects real systems, then an exercise with small numbers and exactly one correct numeric or textual answer. Double-check the arithmetic.`;
  return `You draft lessons for ZKCTF Academy. A human editor will fact-check and edit before publishing.
${focus}
Audience: motivated beginners to intermediate. Plain sentences, no hype, no emojis.
No working exploit against live targets, no payloads usable against real systems.
Cite only sources you are confident exist (official post-mortems, talks, advisories). If unsure, leave sources empty.
Reply with ONE JSON object only:
{"title":"","summary":"","case":{"name":"","date":"YYYY-MM-DD","impact":"","sources":[""]}|null,
 "body":"several paragraphs separated by \\n\\n (800-5000 chars)",
 "exercise":{"statement":"","artifacts":[""],"hints":["",""]},
 "flag":"ZKCTF{...}"}`;
}

async function draft() {
  const track = String(args.track ?? "");
  if (!TRACKS.includes(track)) throw new Error(`--track ${TRACKS.join("|")} is required`);
  const topic = typeof args.topic === "string" ? args.topic : null;
  const caseName = typeof args.case === "string" ? args.case : null;
  let lesson = template({ track, topic, caseName });
  const key = process.env.OPENROUTER_API_KEY ?? "";
  if (!args.blank && key) {
    if (!key.startsWith("sk-or-")) console.warn("OPENROUTER_API_KEY does not look like an OpenRouter key (sk-or-…).");
    const ai = await openrouter([{ role: "user", content: prompt({ track, topic, caseName }) }]);
    lesson = {
      ...lesson,
      ...ai,
      track,
      authors: { ai: process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4", human: null },
      reviewed: false,
      status: "draft",
      publishedAt: null,
    };
  } else if (!args.blank) {
    console.warn("No OPENROUTER_API_KEY — writing a blank template to fill by hand.");
  }
  mkdirSync(DRAFTS, { recursive: true });
  const name = `${lesson.week.toLowerCase()}-${slug(lesson.title.replace(/^TODO title( about)?/, "") || topic || caseName || track)}`;
  lesson.id = name;
  const path = join(DRAFTS, `${name}.json`);
  writeFileSync(path, `${JSON.stringify(lesson, null, 2)}\n`);
  console.log(`Draft written: ${path}`);
  console.log("Edit it (fact-check the case, run the exercise yourself), then:");
  console.log(`  node scripts/lesson.mjs publish ${path} --editor "Your Name"`);
}

function check(path) {
  const l = JSON.parse(readFileSync(path, "utf8"));
  const p = problems(l);
  if (p.length) {
    console.log(`✗ ${basename(path)}`);
    for (const x of p) console.log(`  - ${x}`);
    return false;
  }
  console.log(`✓ ${basename(path)} is ready to publish`);
  return true;
}

function publish(path) {
  const editor = typeof args.editor === "string" ? args.editor.trim() : "";
  if (!editor) throw new Error('--editor "Your Name" is required: a human signs off on every lesson.');
  if (!check(path)) process.exit(1);
  const l = JSON.parse(readFileSync(path, "utf8"));
  const at = typeof args.at === "string" ? new Date(args.at) : new Date();
  if (Number.isNaN(at.getTime())) throw new Error("--at must be an ISO date");
  const out = {
    ...l,
    week: isoWeek(at),
    authors: { ai: l.authors?.ai ?? null, human: editor },
    reviewed: true,
    status: "published",
    publishedAt: at.toISOString(),
  };
  out.id = out.id || `${out.week.toLowerCase()}-${slug(out.title)}`;
  mkdirSync(PUBLISHED, { recursive: true });
  const dest = join(PUBLISHED, `${out.id}.json`);
  if (existsSync(dest)) throw new Error(`${dest} already exists`);
  writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`);
  if (resolve(path).startsWith(resolve(DRAFTS))) renameSync(path, `${path}.published`);
  console.log(`Published ${out.id} (${out.track}) — visible ${out.publishedAt} (Founding members see it earlier).`);
}

function list() {
  for (const [label, dir] of [
    ["published", PUBLISHED],
    ["drafts", DRAFTS],
  ]) {
    const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
    console.log(`${label} (${files.length})`);
    for (const f of files.sort()) {
      const l = JSON.parse(readFileSync(join(dir, f), "utf8"));
      console.log(`  ${l.week ?? "?"}  ${l.track.padEnd(8)}  ${l.title}${l.publishedAt ? `  @ ${l.publishedAt}` : ""}`);
    }
  }
}

try {
  if (cmd === "draft") await draft();
  else if (cmd === "check") process.exit(check(positional[0]) ? 0 : 1);
  else if (cmd === "publish") publish(positional[0]);
  else if (cmd === "list") list();
  else {
    console.log("usage: lesson.mjs draft|check|publish|list (see header)");
    process.exit(1);
  }
} catch (e) {
  console.error(String(e.message ?? e));
  process.exit(1);
}

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { createCommitment, hex32 } from "./relation.mjs";
import { OFFICIAL as FALLBACK } from "./seeds.js";
import { docFor } from "./bot.js";

const dir = process.env.ZKCTF_DATA_DIR
  ? process.env.ZKCTF_DATA_DIR
  : join(dirname(fileURLToPath(import.meta.url)), "../data");
mkdirSync(dir, { recursive: true });
const PATH = join(dir, "round.json");

function loadRaw() {
  if (!existsSync(PATH)) return null;
  try {
    return JSON.parse(readFileSync(PATH, "utf8"));
  } catch {
    return null;
  }
}

function save(row) {
  writeFileSync(PATH, JSON.stringify(row, null, 2));
}

/** Attach fresh delta/h for each level (or keep if present). */
export function sealLevels(levels) {
  return levels.map((lv, i) => {
    const flag = String(lv.flag);
    const delta = lv.delta ? Buffer.from(String(lv.delta).replace(/^0x/, ""), "hex") : randomBytes(32);
    const { h } = createCommitment(flag, delta);
    return {
      id: Number(lv.id ?? i),
      title: String(lv.title ?? `Level ${i}`),
      statement: String(lv.statement ?? ""),
      artifacts: Array.isArray(lv.artifacts) ? lv.artifacts.map(String) : [],
      hints: Array.isArray(lv.hints) ? lv.hints.map(String) : [],
      walkthrough: String(lv.walkthrough ?? ""),
      ...(lv.type ? { type: String(lv.type), doc: String(lv.doc ?? "") } : {}),
      flag,
      delta: hex32(delta),
      h: hex32(h),
    };
  });
}

export function writeRound({ start, end, levels, source = "bot" }) {
  const sealed = sealLevels(levels).slice(0, 8);
  if (sealed.length === 0) throw new Error("need at least one level");
  const row = {
    start: String(start),
    end: String(end),
    source,
    updatedAt: new Date().toISOString(),
    levels: sealed,
  };
  save(row);
  return row;
}

export function readRound() {
  const row = loadRaw();
  if (row?.levels?.length) return row;
  return {
    start: null,
    end: null,
    source: "fallback-seeds",
    levels: FALLBACK,
  };
}

/** Puzzles stay hidden until the round opens so nobody gets a head start (ROUND_REVEAL_EARLY=1 for local dev). */
export function roundOpen(row = readRound(), now = Date.now()) {
  return process.env.ROUND_REVEAL_EARLY === "1" || !row.start || now >= Date.parse(row.start);
}

export function publicLevels() {
  const row = readRound();
  if (!roundOpen(row)) return [];
  return row.levels.map(({ flag, delta, walkthrough, doc, ...rest }) => ({
    ...rest,
    background: doc ? docFor(doc) : null,
  }));
}

export function levelById(id) {
  const row = readRound();
  if (!roundOpen(row)) return null;
  return row.levels.find((l) => Number(l.id) === Number(id)) ?? null;
}

export function roundCommitments() {
  const levels = readRound().levels;
  const out = [];
  for (let i = 0; i < 8; i++) {
    const h = levels[i]?.h;
    out.push(h ? Buffer.from(String(h).replace(/^0x/, ""), "hex") : Buffer.alloc(32));
  }
  return out;
}

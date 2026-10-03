import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = process.env.ZKCTF_DATA_DIR
  ? process.env.ZKCTF_DATA_DIR
  : join(dirname(fileURLToPath(import.meta.url)), "../data");
mkdirSync(dir, { recursive: true });
const ENTRIES = join(dir, "entries.json");
const LESSON_SOLVES = join(dir, "lesson-solves.json");

function load(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function save(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2));
}

export function getEntry(wallet, startIso) {
  const row = load(ENTRIES)[wallet];
  if (!row || row.start !== startIso) return null;
  return row;
}

export function putEntry(wallet, row) {
  const all = load(ENTRIES);
  all[wallet] = row;
  save(ENTRIES, all);
  return row;
}

/** Wallets that entered a given round start (host index — payout still requires on-chain solves). */
export function listEntries(startIso) {
  return Object.entries(load(ENTRIES))
    .filter(([, row]) => row?.start === startIso)
    .map(([wallet, row]) => ({ wallet, ...row }));
}

/** lesson id → solve time (ms) for one wallet. */
export function lessonSolves(wallet) {
  return load(LESSON_SOLVES)[wallet] ?? {};
}

export function recordLessonSolve(wallet, lessonId) {
  const all = load(LESSON_SOLVES);
  const row = all[wallet] ?? {};
  if (!row[lessonId]) row[lessonId] = Date.now();
  all[wallet] = row;
  save(LESSON_SOLVES, all);
  return row;
}

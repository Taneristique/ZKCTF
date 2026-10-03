import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = process.env.ZKCTF_DATA_DIR
  ? process.env.ZKCTF_DATA_DIR
  : join(dirname(fileURLToPath(import.meta.url)), "../data");
mkdirSync(dir, { recursive: true });
const PATH = join(dir, "solves.json");

function load() {
  try {
    return JSON.parse(readFileSync(PATH, "utf8"));
  } catch {
    return {};
  }
}

function save(all) {
  writeFileSync(PATH, JSON.stringify(all, null, 2));
}

function keyOf(startIso, wallet) {
  return `${startIso}::${wallet}`;
}

export function getSolveRow(wallet, startIso) {
  return load()[keyOf(startIso, wallet)] ?? { wallet, start: startIso, levels: {} };
}

/** Sorted numeric level ids solved this round. */
export function solvedIds(wallet, startIso) {
  const row = getSolveRow(wallet, startIso);
  return Object.keys(row.levels)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
}

/**
 * Linear CTF: level N (0-based) is playable only if all 0..N-1 are solved.
 * Level 0 is always playable once entered.
 */
export function canAttempt(wallet, startIso, levelId) {
  const id = Number(levelId);
  if (id === 0) return { ok: true };
  const done = new Set(solvedIds(wallet, startIso));
  for (let i = 0; i < id; i++) {
    if (!done.has(i)) {
      return { ok: false, need: i };
    }
  }
  return { ok: true };
}

export function progress(wallet, startIso, levelCount) {
  const ids = solvedIds(wallet, startIso);
  const done = new Set(ids);
  const n = Number(levelCount) || 0;
  let next = null;
  for (let i = 0; i < n; i++) {
    if (!done.has(i)) {
      next = i;
      break;
    }
  }
  const cleared = n > 0 && ids.length >= n && [...Array(n).keys()].every((i) => done.has(i));
  return {
    solved: ids,
    next,
    cleared,
    levelCount: n,
    finishTime: cleared
      ? Math.max(...Object.values(getSolveRow(wallet, startIso).levels).map(Number))
      : null,
  };
}

/** Record first solve time per wallet/level for a round start. */
export function recordSolve(wallet, levelId, startIso) {
  const all = load();
  const key = keyOf(startIso, wallet);
  const row = all[key] ?? { wallet, start: startIso, levels: {}, firstTs: Date.now() };
  const id = String(levelId);
  if (row.levels[id] == null) {
    row.levels[id] = Date.now();
    all[key] = row;
    save(all);
  }
  return row;
}

/**
 * Rank for host preview / prestige index only.
 * Payout ranking must use on-chain Entry.solved_mask (`rankClearsOnChain` / settle-round).
 * Only wallets that cleared every level; earlier finish time wins.
 */
export function rankSolvers(startIso, levelCount) {
  const n = Number(levelCount) || 0;
  const all = load();
  const rows = Object.values(all).filter((r) => r.start === startIso);
  return rows
    .map((r) => {
      const ids = Object.keys(r.levels)
        .map(Number)
        .filter((x) => !Number.isNaN(x));
      const done = new Set(ids);
      const cleared = n > 0 && [...Array(n).keys()].every((i) => done.has(i));
      const times = Object.values(r.levels).map(Number);
      return {
        wallet: r.wallet,
        score: ids.length,
        cleared,
        time: times.length ? Math.max(...times) : Number.MAX_SAFE_INTEGER,
      };
    })
    .filter((r) => r.cleared)
    .sort((a, b) => a.time - b.time);
}

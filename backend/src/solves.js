import { dataPath, load as loadJson, save as saveJson } from "./store.js";

const PATH = dataPath("solves.json");

function load() {
  return loadJson(PATH);
}

function save(all) {
  saveJson(PATH, all);
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

/** True when a solve row belongs to the same Saturday window (ISO or ms-equal). */
export function sameRoundStart(rowStart, startIso) {
  if (!rowStart || !startIso) return false;
  if (rowStart === startIso) return true;
  const a = Date.parse(rowStart);
  const b = Date.parse(startIso);
  return Number.isFinite(a) && Number.isFinite(b) && a === b;
}

/** Infer level count for a round from the highest level id seen in solves. */
export function inferLevelCount(startIso) {
  const all = load();
  let n = 0;
  for (const r of Object.values(all)) {
    if (!sameRoundStart(r.start, startIso)) continue;
    for (const id of Object.keys(r.levels ?? {}).map(Number)) {
      if (!Number.isNaN(id)) n = Math.max(n, id + 1);
    }
  }
  return n;
}

/**
 * Rank for host preview / prestige / treasury-claim rescue.
 * Payout ranking prefers on-chain Entry.solved_mask when settle finds k>0.
 * Only wallets that cleared every level; earlier finish time wins.
 */
export function rankSolvers(startIso, levelCount) {
  let n = Number(levelCount) || 0;
  if (n <= 0) n = inferLevelCount(startIso);
  if (n <= 0) return [];
  const all = load();
  const rows = Object.values(all).filter((r) => sameRoundStart(r.start, startIso));
  return rows
    .map((r) => {
      const ids = Object.keys(r.levels)
        .map(Number)
        .filter((x) => !Number.isNaN(x));
      const done = new Set(ids);
      const cleared = [...Array(n).keys()].every((i) => done.has(i));
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

/** Rank by on-chain round start (unix seconds). */
export function rankSolversUnix(roundStartS, levelCount) {
  const iso = new Date(Number(roundStartS) * 1000).toISOString();
  return rankSolvers(iso, levelCount);
}

/**
 * Distinct Saturday windows this wallet fully cleared on the host.
 * Each entry: { startIso, round (unix s), finishTime }.
 */
export function hostFinishedRounds(wallet) {
  if (!wallet) return [];
  const all = load();
  const starts = new Set();
  for (const r of Object.values(all)) {
    if (r.wallet !== wallet || !r.start) continue;
    starts.add(r.start);
  }
  const seen = new Set();
  const out = [];
  for (const start of starts) {
    const ms = Date.parse(start);
    const key = Number.isFinite(ms) ? String(ms) : start;
    if (seen.has(key)) continue;
    seen.add(key);
    const nLevels = inferLevelCount(start);
    if (nLevels <= 0) continue;
    const row = Object.values(all).find((r) => r.wallet === wallet && sameRoundStart(r.start, start));
    if (!row?.levels) continue;
    const done = new Set(Object.keys(row.levels).map(Number).filter((x) => !Number.isNaN(x)));
    if (![...Array(nLevels).keys()].every((i) => done.has(i))) continue;
    const times = Object.values(row.levels).map(Number);
    out.push({
      startIso: new Date(ms).toISOString(),
      round: Math.floor(ms / 1000),
      finishTime: times.length ? Math.max(...times) : null,
      levelCount: nLevels,
    });
  }
  return out.sort((a, b) => b.round - a.round);
}

/** How many distinct Saturday windows this wallet fully cleared on the host. */
export function hostFinishCount(wallet) {
  return hostFinishedRounds(wallet).length;
}

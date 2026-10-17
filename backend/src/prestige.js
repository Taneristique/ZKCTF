import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./dataDir.js";
import { solvedIds } from "./solves.js";

const PATH = join(DATA_DIR, "prestige.json");

/** Points per unique official level solve in a season week. Soulbound: wallet-keyed only. */
export const POINTS_PER_SOLVE = 10;

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

function seasonId(startIso) {
  return String(startIso).slice(0, 10);
}

function badgeFor(points) {
  if (points >= 60) return "gold";
  if (points >= 30) return "silver";
  if (points >= 10) return "bronze";
  return "none";
}

/** Award once per (wallet, season, level). */
export function awardSolve(wallet, levelId, startIso) {
  const season = seasonId(startIso);
  const all = load();
  const row = all[wallet] ?? { seasons: {} };
  const seasonRow = row.seasons[season] ?? { points: 0, levels: [] };
  const level = Number(levelId);
  if (!seasonRow.levels.includes(level)) {
    seasonRow.levels.push(level);
    seasonRow.points += POINTS_PER_SOLVE;
    row.seasons[season] = seasonRow;
    all[wallet] = row;
    save(all);
  }
  return publicPrestige(wallet, startIso, all[wallet]);
}

/** If solves.json has levels prestige missed (redeploy / rescue), credit them. */
function syncFromSolves(wallet, startIso, all) {
  const ids = solvedIds(wallet, startIso);
  if (!ids.length) return all[wallet];
  const season = seasonId(startIso);
  const row = all[wallet] ?? { seasons: {} };
  const seasonRow = row.seasons[season] ?? { points: 0, levels: [] };
  let changed = false;
  for (const level of ids) {
    if (!seasonRow.levels.includes(level)) {
      seasonRow.levels.push(level);
      seasonRow.points += POINTS_PER_SOLVE;
      changed = true;
    }
  }
  if (changed) {
    row.seasons[season] = seasonRow;
    all[wallet] = row;
    save(all);
  }
  return all[wallet];
}

export function getPrestige(wallet, startIso) {
  const all = load();
  const row = syncFromSolves(wallet, startIso, all);
  return publicPrestige(wallet, startIso, row);
}

function publicPrestige(wallet, startIso, row) {
  const season = seasonId(startIso);
  const seasonRow = row?.seasons?.[season] ?? { points: 0, levels: [] };
  const lifetime = Object.values(row?.seasons ?? {}).reduce((s, r) => s + (r.points ?? 0), 0);
  return {
    wallet,
    season,
    points: seasonRow.points ?? 0,
    levels: seasonRow.levels ?? [],
    badge: badgeFor(seasonRow.points ?? 0),
    lifetime,
    transferable: false,
    yield: false,
    note: "Season points stay on this wallet. They do not change the weekly USDC split.",
  };
}

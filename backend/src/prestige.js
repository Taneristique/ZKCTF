import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = process.env.ZKCTF_DATA_DIR
  ? process.env.ZKCTF_DATA_DIR
  : join(dirname(fileURLToPath(import.meta.url)), "../data");
mkdirSync(dir, { recursive: true });
const PATH = join(dir, "prestige.json");

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

export function getPrestige(wallet, startIso) {
  const all = load();
  return publicPrestige(wallet, startIso, all[wallet]);
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

/**
 * External contest / bounty portfolio (Sherlock-style aggregator).
 * Stored on the volume; never touches race pot, prestige, or settle.
 */
import { randomBytes } from "node:crypto";
import { dataPath, load, save } from "./store.js";

const PATH = dataPath("contests.json");

export const PLATFORMS = {
  sherlock: { id: "sherlock", label: "Sherlock" },
  code4rena: { id: "code4rena", label: "Code4rena" },
  cantina: { id: "cantina", label: "Cantina" },
  codehawks: { id: "codehawks", label: "CodeHawks" },
  immunefi: { id: "immunefi", label: "Immunefi" },
  hackenproof: { id: "hackenproof", label: "HackenProof" },
  other: { id: "other", label: "Other" },
};

const SEVERITIES = new Set(["critical", "high", "medium", "low", "info", ""]);

function db() {
  return load(PATH);
}

function persist(all) {
  save(PATH, all);
}

function id() {
  return randomBytes(8).toString("hex");
}

export function contestsFor(wallet) {
  const rows = db()[wallet] ?? [];
  return [...rows].sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
}

/** Public feed + summary chips for /u. */
export function contestPortfolio(wallet) {
  const items = contestsFor(wallet);
  let earnedUsdc = 0;
  let firstPlaces = 0;
  let payouts = 0;
  const byPlatform = {};
  for (const p of Object.keys(PLATFORMS)) byPlatform[p] = 0;
  for (const row of items) {
    const prize = Number(row.prizeUsdc) || 0;
    if (prize > 0) {
      earnedUsdc += prize;
      payouts++;
    }
    if (Number(row.rank) === 1) firstPlaces++;
    if (byPlatform[row.platform] != null) byPlatform[row.platform]++;
    else byPlatform.other++;
  }
  return {
    items,
    platforms: PLATFORMS,
    summary: {
      count: items.length,
      payouts,
      firstPlaces,
      earnedUsdc: Math.round(earnedUsdc * 100) / 100,
      byPlatform,
    },
  };
}

export function addContest(wallet, raw) {
  const platform = String(raw.platform ?? "").toLowerCase();
  if (!PLATFORMS[platform]) {
    return { ok: false, error: "Unknown platform. Use sherlock, code4rena, cantina, codehawks, immunefi, hackenproof, or other." };
  }
  const title = String(raw.title ?? "").trim().slice(0, 120);
  if (title.length < 2) return { ok: false, error: "Contest / project title required." };
  const url = String(raw.url ?? "").trim().slice(0, 500);
  if (url && !/^https:\/\//i.test(url)) return { ok: false, error: "Proof URL must start with https://" };
  const severity = String(raw.severity ?? "").toLowerCase();
  if (!SEVERITIES.has(severity)) return { ok: false, error: "Bad severity." };
  const rank = raw.rank == null || raw.rank === "" ? null : Number(raw.rank);
  if (rank != null && (!Number.isFinite(rank) || rank < 1 || rank > 10_000)) {
    return { ok: false, error: "Rank must be a positive number." };
  }
  const prizeUsdc = raw.prizeUsdc == null || raw.prizeUsdc === "" ? 0 : Number(raw.prizeUsdc);
  if (!Number.isFinite(prizeUsdc) || prizeUsdc < 0 || prizeUsdc > 1e9) {
    return { ok: false, error: "Bad prize amount." };
  }
  const finding = String(raw.finding ?? "").trim().slice(0, 280);
  const atRaw = raw.at ? Date.parse(raw.at) : Date.now();
  const at = Number.isFinite(atRaw) ? atRaw : Date.now();

  const row = {
    id: id(),
    platform,
    title,
    url: url || null,
    rank,
    prizeUsdc,
    severity: severity || null,
    finding: finding || null,
    at,
    verified: false, // host-reviewed later; public link is the proof for now
  };
  const all = db();
  const list = all[wallet] ?? [];
  list.unshift(row);
  all[wallet] = list.slice(0, 200);
  persist(all);
  return { ok: true, item: row };
}

export function removeContest(wallet, itemId) {
  const all = db();
  const list = all[wallet] ?? [];
  const next = list.filter((r) => r.id !== itemId);
  if (next.length === list.length) return { ok: false, error: "Not found." };
  all[wallet] = next;
  persist(all);
  return { ok: true };
}

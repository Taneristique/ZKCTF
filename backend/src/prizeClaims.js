/**
 * Prize claims after Saturday settle.
 *
 * Happy path (Lock A): settle already paid on-chain finishers → status "paid-settle".
 * Treasury path: settle ran with k=0 (entire pot → treasury) but host had full clears
 * → status "claimable"; player claims SOL from the treasury wallet (authority signs).
 *
 * Never invents winners: host board (solves.json full clears) + pot lamports from settle only.
 */
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { dataPath, load, save } from "./store.js";
import { splitPot, ENTRY_ATOMS, N_WINNERS } from "./payout.js";
import { sendAndConfirm } from "./chain.js";
import { treasuryOwner } from "./membership.js";
import { rankSolversUnix, inferLevelCount } from "./solves.js";
import { recordHostPlacements, applyPlacementPrizes } from "./weekNft.js";

const PATH = dataPath("prize-claims.json");

function db() {
  return load(PATH);
}

function persist(all) {
  save(PATH, all);
}

function roundBucket(all, roundKey) {
  const key = String(roundKey);
  all[key] ??= {};
  return all[key];
}

/** After a successful on-chain settle that paid winners. `paysSol` is SOL amounts. */
export function recordSettlePaid(roundKey, winners, paysSol, settleSig) {
  const all = db();
  const bucket = roundBucket(all, roundKey);
  for (let i = 0; i < winners.length; i++) {
    const wallet = winners[i];
    const prizeSol = Number(paysSol[i] ?? 0);
    bucket[wallet] = {
      rank: i + 1,
      prizeSol,
      prizeUsdc: prizeSol, // legacy field name for older UI rows
      atoms: Math.round(prizeSol * 1e9),
      status: "paid-settle",
      settleSig: settleSig ?? null,
      claimSig: null,
      reason: "on-chain settle",
      at: Date.now(),
    };
  }
  persist(all);
  applyPlacementPrizes(roundKey, winners, paysSol);
  return { recorded: winners.length };
}

/**
 * When settle paid nobody (k=0), open treasury claims for host-ranked finishers.
 * Idempotent for claimed / paid-settle / claiming.
 * `rebalance` updates still-claimable rows when the host board grows (correct split).
 */
export function openRescueClaims(roundKey, { potAtoms, hostWinners, settleSig, rebalance = false }) {
  const wallets = (hostWinners ?? []).filter(Boolean);
  const pot = Number(potAtoms) || 0;
  if (!wallets.length || pot <= 0) return { opened: 0, updated: 0, potAtoms: pot };
  const { pays } = splitPot(pot, wallets.length);
  const all = db();
  const bucket = roundBucket(all, roundKey);
  let opened = 0;
  let updated = 0;
  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    const prev = bucket[wallet];
    if (prev?.status === "paid-settle" || prev?.status === "claimed" || prev?.status === "claiming") {
      continue;
    }
    const atoms = Number(pays[i] ?? 0);
    if (atoms <= 0) continue;
    if (prev?.status === "claimable" && prev.atoms > 0 && !rebalance) continue;
    if (prev?.status === "claimable" && prev.atoms === atoms && prev.rank === i + 1) continue;
    const wasOpen = prev?.status === "claimable" && prev.atoms > 0;
    const prizeSol = atoms / 1e9;
    bucket[wallet] = {
      rank: i + 1,
      prizeSol,
      prizeUsdc: prizeSol,
      atoms,
      status: "claimable",
      settleSig: settleSig ?? prev?.settleSig ?? null,
      claimSig: null,
      reason: "treasury-after-settle-k0",
      at: prev?.at ?? Date.now(),
      updatedAt: Date.now(),
    };
    if (wasOpen) updated++;
    else opened++;
  }
  if (opened || updated) persist(all);
  const paysSol = pays.slice(0, wallets.length).map((a) => a / 1e9);
  applyPlacementPrizes(roundKey, wallets, paysSol);
  return { opened, updated, potAtoms: pot, finishers: wallets.length };
}

/**
 * Re-rank host full clears and open treasury claims for a settled k=0 round.
 * Safe to call every tick — does not overwrite claimed / paid-settle rows.
 */
export function reconcileTreasuryRound(roundKey, opts = {}) {
  const key = Number(roundKey) || roundKey;
  const iso = new Date(Number(key) * 1000).toISOString();
  const levelCount = Number(opts.levelCount) || inferLevelCount(iso) || 4;
  const ranked = rankSolversUnix(key, levelCount)
    .slice(0, N_WINNERS)
    .map((r) => r.wallet);
  const fromNfts = hostWinnersFromNfts(key);
  const wallets = ranked.length ? ranked : fromNfts;
  if (!wallets.length) {
    return { ok: false, error: "no-host-finishers", round: key, levelCount };
  }

  let potAtoms = Number(opts.potAtoms) || 0;
  if (potAtoms <= 0 && opts.entryCount > 0) {
    potAtoms = Number(opts.entryCount) * ENTRY_ATOMS;
  }
  // Last resort: one entry per finisher (never invents more than finishers × entry).
  if (potAtoms <= 0) {
    potAtoms = wallets.length * ENTRY_ATOMS;
  }

  const { pays } = splitPot(potAtoms, wallets.length);
  const paysSol = pays.slice(0, wallets.length).map((a) => a / 1e9);
  const snap = recordHostPlacements(key, wallets, { source: "host-reconcile", paysUsdc: paysSol });
  const rescue = openRescueClaims(key, {
    potAtoms,
    hostWinners: wallets,
    settleSig: opts.settleSig ?? null,
    rebalance: true,
  });
  return {
    ok: true,
    round: key,
    levelCount,
    wallets,
    placements: snap,
    ...rescue,
  };
}

/** Seed / merge claimable rows (fixture). Never overwrite claimed/paid. */
export function mergeClaims(fixtureClaims) {
  const all = db();
  let n = 0;
  for (const [roundKey, rows] of Object.entries(fixtureClaims ?? {})) {
    const bucket = roundBucket(all, roundKey);
    for (const [wallet, row] of Object.entries(rows)) {
      if (bucket[wallet]?.status === "claimed" || bucket[wallet]?.status === "paid-settle") continue;
      if (bucket[wallet]?.status === "claimable" && bucket[wallet].atoms > 0) continue;
      const prizeSol = Number(row.prizeSol ?? row.prizeUsdc ?? 0);
      bucket[wallet] = {
        ...row,
        prizeSol,
        prizeUsdc: prizeSol,
        atoms: row.atoms ?? Math.round(prizeSol * 1e9),
      };
      n++;
    }
  }
  if (n) persist(all);
  return n;
}

export function claimsFor(wallet) {
  const all = db();
  const out = [];
  for (const [round, rows] of Object.entries(all)) {
    const row = rows[wallet];
    if (!row) continue;
    out.push({
      round: Number(round) || round,
      day: Number(round) ? new Date(Number(round) * 1000).toISOString().slice(0, 10) : null,
      ...row,
    });
  }
  return out.sort((a, b) => Number(b.round) - Number(a.round));
}

export function claimableFor(wallet) {
  return claimsFor(wallet).filter((c) => c.status === "claimable" && c.atoms > 0);
}

/**
 * Pay one claimable prize from treasury wallet → player (native SOL).
 * Marks claiming before broadcast to avoid double-pay on crash/retry.
 */
export async function executeClaim({ connection, authority, wallet, roundKey }) {
  const all = db();
  const bucket = all[String(roundKey)];
  const row = bucket?.[wallet];
  if (!row || row.status !== "claimable" || !(row.atoms > 0)) {
    return { ok: false, error: "No claimable prize for this round." };
  }
  // Cap ~100 SOL per claim — guards against corrupt claim rows.
  if (!Number.isInteger(row.atoms) || row.atoms > 100_000_000_000) {
    return { ok: false, error: "Invalid claim amount." };
  }

  row.status = "claiming";
  row.claimAttemptAt = Date.now();
  persist(all);

  try {
    const owner = treasuryOwner(authority);
    if (owner.toBase58() !== authority.publicKey.toBase58()) {
      row.status = "claimable";
      persist(all);
      return { ok: false, error: "Treasury owner mismatch — claims paused." };
    }
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: owner,
        toPubkey: new PublicKey(wallet),
        lamports: row.atoms,
      }),
    );
    const sig = await sendAndConfirm(connection, tx, [authority]);
    row.status = "claimed";
    row.claimSig = sig;
    row.claimedAt = Date.now();
    persist(all);

    const prizeSol = row.prizeSol ?? row.prizeUsdc ?? row.atoms / 1e9;
    try {
      const nftPath = dataPath("week-nfts.json");
      const nfts = load(nftPath);
      if (nfts[String(roundKey)]?.[wallet]) {
        nfts[String(roundKey)][wallet].prizeSol = prizeSol;
        nfts[String(roundKey)][wallet].prizeUsdc = prizeSol;
        nfts[String(roundKey)][wallet].claimSig = sig;
        nfts[String(roundKey)][wallet].status =
          nfts[String(roundKey)][wallet].status === "ok"
            ? "ok"
            : "claimed";
        save(nftPath, nfts);
      }
    } catch {
      /* optional */
    }

    return { ok: true, sig, prizeSol, prizeUsdc: prizeSol, rank: row.rank };
  } catch (e) {
    row.status = "claimable";
    row.claimError = String(e.message ?? e);
    persist(all);
    return { ok: false, error: String(e.message ?? e) };
  }
}

/** Host winners for a unix round key from week-nfts.json (ordered by rank). */
export function hostWinnersFromNfts(roundKey) {
  const nfts = load(dataPath("week-nfts.json"))[String(roundKey)] ?? {};
  return Object.entries(nfts)
    .map(([wallet, row]) => ({ wallet, rank: Number(row.rank) || 999 }))
    .sort((a, b) => a.rank - b.rank)
    .map((r) => r.wallet);
}

/** Stuck "claiming" rows older than 15m → claimable again. */
export function releaseStaleClaims(maxAgeMs = 15 * 60_000) {
  const all = db();
  const now = Date.now();
  let n = 0;
  for (const rows of Object.values(all)) {
    for (const row of Object.values(rows ?? {})) {
      if (row.status === "claiming" && now - (row.claimAttemptAt ?? 0) > maxAgeMs) {
        row.status = "claimable";
        n++;
      }
    }
  }
  if (n) persist(all);
  return n;
}

export { ENTRY_ATOMS };

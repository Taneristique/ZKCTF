/**
 * Prize claims after Saturday settle.
 *
 * Happy path (Lock A): settle already paid on-chain finishers → status "paid-settle".
 * Rescue path: settle ran with k=0 (pot → treasury) but host had full clears who entered
 * that round → status "claimable"; player claims USDC from treasury ATA (authority signs).
 *
 * Never invents winners: host board + paid entry for that round only.
 */
import { Transaction } from "@solana/web3.js";
import { dataPath, load, save } from "./store.js";
import { splitPot, ENTRY_ATOMS } from "./payout.js";
import { ata, createAtaIdempotentIx, tokenTransferIx, sendAndConfirm } from "./chain.js";
import { treasuryOwner } from "./membership.js";

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

/** After a successful on-chain settle that paid winners. */
export function recordSettlePaid(roundKey, winners, paysUsdc, settleSig) {
  const all = db();
  const bucket = roundBucket(all, roundKey);
  for (let i = 0; i < winners.length; i++) {
    const wallet = winners[i];
    const prizeUsdc = Number(paysUsdc[i] ?? 0);
    bucket[wallet] = {
      rank: i + 1,
      prizeUsdc,
      atoms: Math.round(prizeUsdc * 1e6),
      status: "paid-settle",
      settleSig: settleSig ?? null,
      claimSig: null,
      reason: "on-chain settle",
      at: Date.now(),
    };
  }
  persist(all);
  return { recorded: winners.length };
}

/**
 * When settle paid nobody (k=0), open treasury claims for host-ranked finishers
 * who paid into that round (host entry index or week-nft row).
 */
export function openRescueClaims(roundKey, { potAtoms, hostWinners, settleSig }) {
  const wallets = (hostWinners ?? []).filter(Boolean);
  if (!wallets.length || !potAtoms) return { opened: 0 };
  const { pays } = splitPot(Number(potAtoms), wallets.length);
  const all = db();
  const bucket = roundBucket(all, roundKey);
  let opened = 0;
  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    if (bucket[wallet]?.status === "paid-settle" || bucket[wallet]?.status === "claimed") continue;
    if (bucket[wallet]?.status === "claimable") continue;
    const atoms = Number(pays[i] ?? 0);
    if (atoms <= 0) continue;
    bucket[wallet] = {
      rank: i + 1,
      prizeUsdc: atoms / 1e6,
      atoms,
      status: "claimable",
      settleSig: settleSig ?? null,
      claimSig: null,
      reason: "settle-k0-host-board",
      at: Date.now(),
    };
    opened++;
  }
  if (opened) persist(all);
  return { opened };
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
      bucket[wallet] = { ...row, atoms: row.atoms ?? Math.round((row.prizeUsdc ?? 0) * 1e6) };
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
 * Pay one claimable prize from treasury ATA → player ATA.
 * Authority must own the treasury USDC.
 */
export async function executeClaim({ connection, authority, wallet, roundKey }) {
  const all = db();
  const bucket = all[String(roundKey)];
  const row = bucket?.[wallet];
  if (!row || row.status !== "claimable" || !(row.atoms > 0)) {
    return { ok: false, error: "No claimable prize for this round." };
  }
  const owner = treasuryOwner(authority);
  const source = ata(owner);
  const dest = ata(wallet);
  const tx = new Transaction().add(
    createAtaIdempotentIx({ payer: authority.publicKey, owner: wallet }),
    tokenTransferIx({
      source: source.toBase58(),
      dest: dest.toBase58(),
      owner: owner.toBase58(),
      atoms: row.atoms,
    }),
  );
  // Authority must sign as treasury owner (same wallet in production).
  const sig = await sendAndConfirm(connection, tx, [authority]);
  row.status = "claimed";
  row.claimSig = sig;
  row.claimedAt = Date.now();
  persist(all);

  // Mirror prize onto week-nft activity when present.
  try {
    const nftPath = dataPath("week-nfts.json");
    const nfts = load(nftPath);
    if (nfts[String(roundKey)]?.[wallet]) {
      nfts[String(roundKey)][wallet].prizeUsdc = row.prizeUsdc;
      nfts[String(roundKey)][wallet].claimSig = sig;
      save(nftPath, nfts);
    }
  } catch {
    /* optional */
  }

  return { ok: true, sig, prizeUsdc: row.prizeUsdc, rank: row.rank };
}

/** Host winners for a unix round key from week-nfts.json (ordered by rank). */
export function hostWinnersFromNfts(roundKey) {
  const nfts = load(dataPath("week-nfts.json"))[String(roundKey)] ?? {};
  return Object.entries(nfts)
    .map(([wallet, row]) => ({ wallet, rank: Number(row.rank) || 999 }))
    .sort((a, b) => a.rank - b.rank)
    .map((r) => r.wallet);
}

export { ENTRY_ATOMS };

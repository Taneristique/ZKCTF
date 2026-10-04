/**
 * Academy membership, paid in USDC on-chain. No card processor.
 * One transaction: USDC transfer → treasury ATA + authority-co-signed mint_seat.
 * Seat tier 1 = Founding member (early-customer perk), tier 0 = regular member.
 */
import { PublicKey } from "@solana/web3.js";
import {
  PROGRAM_ID,
  USDC_MINT,
  SEAT_SPACE,
  SEAT_TIER_OFFSET,
  ata,
  parseSeat,
  seatPda,
  mintSeatIx,
  tokenTransferIx,
  createAtaIdempotentIx,
  recentTx,
} from "./chain.js";
import { excludedFounders, snapshotFounder } from "./founders.js";

const USDC_ATOMS = 1_000_000;

/** Regular price per plan length (months → USDC). mint_seat accepts 1, 3 or 12 months. */
export const PLANS = {
  1: { months: 1, usdc: 10 },
  3: { months: 3, usdc: 27 },
  12: { months: 12, usdc: 90 },
};

export const FOUNDING = {
  seats: Number(process.env.FOUNDING_SEATS ?? 100),
  discountBps: Number(process.env.FOUNDING_DISCOUNT_BPS ?? 5_000),
  earlyAccessHours: Number(process.env.FOUNDING_EARLY_HOURS ?? 24),
};

export function treasuryOwner(authority) {
  return new PublicKey(process.env.TREASURY_WALLET ?? authority.publicKey);
}

export function priceAtoms(months, founding) {
  const plan = PLANS[months];
  if (!plan) return null;
  const full = plan.usdc * USDC_ATOMS;
  return founding ? Math.round((full * (10_000 - FOUNDING.discountBps)) / 10_000) : full;
}

export function planTable(founding) {
  return Object.values(PLANS).map((p) => ({
    months: p.months,
    usdc: p.usdc,
    priceUsdc: priceAtoms(p.months, founding) / USDC_ATOMS,
  }));
}

/** On-chain seat for a wallet. Founding status survives expiry (price lock on renewal). */
export async function memberStatus(connection, wallet) {
  let key;
  try {
    key = new PublicKey(wallet);
  } catch {
    return { active: false, founding: false, expiry: null, source: "none" };
  }
  const [pda] = seatPda(key);
  const info = await connection.getAccountInfo(pda);
  const row = info && info.owner.equals(PROGRAM_ID) ? parseSeat(info.data) : null;
  if (!row) return { active: false, founding: false, expiry: null, source: "none", seat: pda.toBase58() };
  return {
    active: Date.now() / 1000 <= row.expiry,
    founding: row.tier === 1,
    expiry: row.expiry * 1000,
    months: row.months,
    source: "chain",
    seat: pda.toBase58(),
  };
}

/** Founding seats on chain, not counting FOUNDING_EXCLUDE team wallets. */
export async function foundingTaken(connection) {
  const rows = await connection.getProgramAccounts(PROGRAM_ID, {
    dataSlice: { offset: 8, length: 32 },
    filters: [
      { dataSize: SEAT_SPACE },
      // "2" is base58 for the single byte 0x01 (tier = Founding).
      { memcmp: { offset: SEAT_TIER_OFFSET, bytes: "2" } },
    ],
  });
  const skip = excludedFounders();
  return rows.filter((r) => !skip.has(new PublicKey(r.account.data).toBase58())).length;
}

/**
 * Founding seats handed out in checkouts that are signed but not yet on chain (wallet → expiry ms).
 * Counting them closes the window where two simultaneous buyers both get the last seat.
 */
const pending = new Map();
const HOLD_MS = 120_000;

function pendingFor(except) {
  const now = Date.now();
  let n = 0;
  for (const [w, until] of pending) {
    if (until <= now) pending.delete(w);
    else if (w !== except) n++;
  }
  return n;
}

export function holdFoundingSeat(wallet) {
  pending.set(wallet, Date.now() + HOLD_MS);
}

export function releaseFoundingSeat(wallet) {
  pending.delete(wallet);
}

/**
 * Who pays the Founding price, and with which seat tier:
 * - Founding members (tier 1 seat) keep it on renewals.
 * - New buyers get a tier 1 seat while seats remain (signed-but-unconfirmed checkouts count as taken).
 * - Founders from a previous deployment (FOUNDER_SNAPSHOT) get it once, on their first purchase here:
 *   the seat is tier 0, so renewals are at the regular price. Their badge comes from the snapshot.
 */
export async function foundingOffer(connection, wallet) {
  const [status, onChain] = await Promise.all([
    wallet ? memberStatus(connection, wallet) : Promise.resolve(null),
    foundingTaken(connection),
  ]);
  const taken = onChain + pendingFor(wallet);
  const left = Math.max(0, FOUNDING.seats - taken);
  const carried = wallet ? snapshotFounder(wallet) : null;
  const firstPurchase = !status?.expiry;
  let tier = 0;
  if (status?.founding || (!carried && left > 0)) tier = 1;
  const carriedDiscount = Boolean(carried) && firstPurchase && tier === 0;
  return { status, taken, left, eligible: tier === 1 || carriedDiscount, tier, carried, carriedDiscount };
}

export async function buildCheckoutTx({ connection, authority, wallet, months, founding, tier = founding ? 1 : 0 }) {
  const atoms = priceAtoms(months, founding);
  if (atoms == null) throw new Error("Pick a 1, 3 or 12 month plan.");
  const member = new PublicKey(wallet);
  const owner = treasuryOwner(authority);
  const tx = await recentTx(connection, member);
  tx.add(
    createAtaIdempotentIx({ payer: member, owner }),
    tokenTransferIx({ source: ata(member), dest: ata(owner), owner: member, atoms }),
    mintSeatIx({
      payer: member.toBase58(),
      wallet: member.toBase58(),
      authority: authority.publicKey.toBase58(),
      tier,
      months,
      slots: 0,
    }),
  );
  return { tx, atoms, treasuryAta: ata(owner).toBase58(), mint: USDC_MINT.toBase58() };
}

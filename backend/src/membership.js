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

export async function foundingTaken(connection) {
  const rows = await connection.getProgramAccounts(PROGRAM_ID, {
    dataSlice: { offset: 0, length: 0 },
    filters: [
      { dataSize: SEAT_SPACE },
      // "2" is base58 for the single byte 0x01 (tier = Founding).
      { memcmp: { offset: SEAT_TIER_OFFSET, bytes: "2" } },
    ],
  });
  return rows.length;
}

/** Founding price applies to existing Founding members and while Founding seats remain. */
export async function foundingOffer(connection, wallet) {
  const [status, taken] = await Promise.all([
    wallet ? memberStatus(connection, wallet) : Promise.resolve(null),
    foundingTaken(connection),
  ]);
  const left = Math.max(0, FOUNDING.seats - taken);
  const eligible = Boolean(status?.founding) || left > 0;
  return { status, taken, left, eligible };
}

export async function buildCheckoutTx({ connection, authority, wallet, months, founding }) {
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
      tier: founding ? 1 : 0,
      months,
      slots: 0,
    }),
  );
  return { tx, atoms, treasuryAta: ata(owner).toBase58(), mint: USDC_MINT.toBase58() };
}

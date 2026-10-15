/**
 * Academy gift: clear N full rounds (Finisher balance) → claim 1 month membership once.
 * Requires the member wallet to sign mint_seat (program rule); no USDC transfer.
 */
import { PublicKey } from "@solana/web3.js";
import { dataPath, load, save } from "./store.js";
import { loyaltyCount } from "./loyalty.js";
import { memberStatus } from "./membership.js";
import { mintSeatIx, recentTx } from "./chain.js";

const PATH = dataPath("academy-gifts.json");
export const GIFT_FINISHES = Number(process.env.ACADEMY_GIFT_FINISHES ?? 3);
export const GIFT_MONTHS = 1;

function db() {
  return load(PATH);
}

export function giftClaimed(wallet) {
  return Boolean(db()[wallet]?.claimedAt);
}

/** Prevent two parallel authority-signed gift txs before confirm lands. */
const giftHold = new Map();
const GIFT_HOLD_MS = 120_000;

function giftHeld(wallet) {
  const until = giftHold.get(wallet);
  if (!until) return false;
  if (until <= Date.now()) {
    giftHold.delete(wallet);
    return false;
  }
  return true;
}

export function holdGiftClaim(wallet) {
  giftHold.set(wallet, Date.now() + GIFT_HOLD_MS);
}

export function releaseGiftClaim(wallet) {
  giftHold.delete(wallet);
}

export async function giftStatus(connection, wallet) {
  const finishes = await loyaltyCount(connection, wallet);
  const claimed = giftClaimed(wallet);
  const held = giftHeld(wallet);
  const member = await memberStatus(connection, wallet);
  const eligible = finishes >= GIFT_FINISHES && !claimed && !held;
  return {
    finishes,
    need: GIFT_FINISHES,
    months: GIFT_MONTHS,
    claimed,
    claimedAt: db()[wallet]?.claimedAt ?? null,
    eligible,
    alreadyMember: Boolean(member?.active),
    note: eligible
      ? `Claim ${GIFT_MONTHS} month of Academy (once). No USDC — you only sign the seat tx.`
      : claimed
        ? "Academy gift already claimed on this wallet."
        : `Finish ${GIFT_FINISHES} full races (Finisher balance) to unlock 1 free Academy month.`,
  };
}

/** Build authority-co-signed mint_seat for 1 month, tier 0, no USDC. */
export async function buildGiftTx({ connection, authority, wallet }) {
  const status = await giftStatus(connection, wallet);
  if (status.claimed) throw new Error("Academy gift already claimed.");
  if (giftHeld(wallet)) throw new Error("Gift claim already in progress. Wait for the previous tx or ~2 minutes.");
  if (!status.eligible) throw new Error(`Need ${GIFT_FINISHES} Finisher rounds; you have ${status.finishes}.`);
  const member = new PublicKey(wallet);
  const tx = await recentTx(connection, member);
  tx.add(
    mintSeatIx({
      payer: member.toBase58(),
      wallet: member.toBase58(),
      authority: authority.publicKey.toBase58(),
      tier: 0,
      months: GIFT_MONTHS,
      slots: 0,
    }),
  );
  holdGiftClaim(wallet);
  return { tx, months: GIFT_MONTHS };
}

export function markGiftClaimed(wallet, signature) {
  const all = db();
  if (all[wallet]?.claimedAt) {
    releaseGiftClaim(wallet);
    return all[wallet];
  }
  all[wallet] = { claimedAt: Date.now(), signature: signature ?? null, months: GIFT_MONTHS };
  save(PATH, all);
  releaseGiftClaim(wallet);
  return all[wallet];
}

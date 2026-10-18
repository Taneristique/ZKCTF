/**
 * Academy gift: clear N full rounds (Finisher balance / host clears) → claim 1 month once.
 * Requires the member wallet to sign mint_seat (program rule); no USDC transfer.
 */
import { PublicKey } from "@solana/web3.js";
import { dataPath, load, save } from "./store.js";
import { loyaltyCount } from "./loyalty.js";
import { hostFinishCount } from "./solves.js";
import { weekNftsFor } from "./weekNft.js";
import { memberStatus } from "./membership.js";
import { mintSeatIx, recentTx } from "./chain.js";

const PATH = dataPath("academy-gifts.json");
const LOYALTY_PATH = dataPath("loyalty.json");
export const GIFT_FINISHES = Number(process.env.ACADEMY_GIFT_FINISHES ?? 3);
export const GIFT_MONTHS = 1;

function db() {
  return load(PATH);
}

export function giftClaimed(wallet) {
  return Boolean(db()[wallet]?.claimedAt);
}

/** Rounds recorded as minted (or in-flight) in loyalty.json for this wallet. */
function loyaltyFileFinishCount(wallet) {
  const all = load(LOYALTY_PATH);
  let n = 0;
  for (const round of Object.values(all)) {
    if (!round || typeof round !== "object") continue;
    const row = round[wallet];
    if (row?.status === "ok" || row?.status === "sent") n++;
  }
  return n;
}

/**
 * Best available finish count for this wallet:
 * on-chain Finisher balance, host full clears, week placements, loyalty mint ledger.
 */
export async function finishCountForGift(connection, wallet) {
  const [onChain, host, file] = await Promise.all([
    loyaltyCount(connection, wallet).catch(() => 0),
    Promise.resolve(hostFinishCount(wallet)),
    Promise.resolve(loyaltyFileFinishCount(wallet)),
  ]);
  const week = weekNftsFor(wallet).filter((n) => n.rank >= 1 && n.rank <= 10).length;
  const finishes = Math.max(onChain, host, file, week);
  return { finishes, onChain, host, file, week };
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
  const counts = await finishCountForGift(connection, wallet);
  const finishes = counts.finishes;
  const claimed = giftClaimed(wallet);
  const held = giftHeld(wallet);
  const member = await memberStatus(connection, wallet);
  const need = GIFT_FINISHES;
  const left = Math.max(0, need - finishes);
  const eligible = finishes >= need && !claimed && !held;
  return {
    finishes,
    need,
    left,
    months: GIFT_MONTHS,
    claimed,
    claimedAt: db()[wallet]?.claimedAt ?? null,
    eligible,
    alreadyMember: Boolean(member?.active),
    sources: {
      onChain: counts.onChain,
      host: counts.host,
      loyaltyFile: counts.file,
      weekPlacements: counts.week,
    },
    note: eligible
      ? `Claim ${GIFT_MONTHS} month of Academy (once). No USDC — you only sign the seat tx.`
      : claimed
        ? "Academy gift already claimed on this wallet."
        : left === 0
          ? `Ready — ${finishes}/${need} races finished.`
          : `You have finished ${finishes} of ${need} full races. ${left} more to unlock 1 free Academy month.`,
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

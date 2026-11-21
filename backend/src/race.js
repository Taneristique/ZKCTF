export { ENTRY_ATOMS, ENTRY_LAMPORTS, N_WINNERS, TREASURY_BPS, WEIGHTS, splitPot, example } from "./payout.js";
export const ENTRY_SOL = 0.05;
/** @deprecated use ENTRY_SOL — race entry is native SOL */
export const ENTRY_USDC = ENTRY_SOL;
export const CLUSTER = process.env.SOLANA_CLUSTER ?? "devnet";
export const ASSET = "SOL";

/** Current race window if it is live, otherwise the next one: Saturday 15:00 UTC for 24 hours. */
export function saturdayWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 15, 0, 0, 0));
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 1) % 7));
  let end = new Date(start.getTime() + 24 * 3600_000);
  if (now >= end) {
    start.setUTCDate(start.getUTCDate() + 7);
    end = new Date(start.getTime() + 24 * 3600_000);
  }
  return { start, end, live: now >= start && now < end };
}

/**
 * Founding members registry: the first FOUNDING.seats wallets that bought a membership.
 *
 * Source of truth is the chain (Seat PDAs with tier = 1). This file keeps an ordered, durable copy
 * (ordinal, first payment signature, time) so the list survives a future program redeploy and can be
 * exported as the snapshot that gives Founders their discount on mainnet.
 */
import { readFileSync } from "node:fs";
import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, SEAT_SPACE, SEAT_TIER_OFFSET } from "./chain.js";
import { dataPath, load, save } from "./store.js";

const PATH = dataPath("founders.json");

export function founders() {
  return Object.values(load(PATH)).sort((a, b) => a.ordinal - b.ordinal);
}

export function founderFor(wallet) {
  return load(PATH)[wallet] ?? null;
}

let running = null;
/** Pull new Founding seats from chain into the registry. Safe to call often; concurrent calls share one run. */
export function syncFounders(connection) {
  running ??= sync(connection).finally(() => {
    running = null;
  });
  return running;
}

async function sync(connection) {
  const rows = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      { dataSize: SEAT_SPACE },
      // "2" is base58 for the single byte 0x01 (tier = Founding).
      { memcmp: { offset: SEAT_TIER_OFFSET, bytes: "2" } },
    ],
  });
  const all = load(PATH);
  const fresh = [];
  for (const { pubkey, account } of rows) {
    const wallet = new PublicKey(account.data.subarray(8, 40)).toBase58();
    if (all[wallet]) continue;
    const sigs = await connection.getSignaturesForAddress(pubkey, { limit: 1000 });
    const first = sigs.filter((s) => !s.err).at(-1);
    fresh.push({
      wallet,
      seat: pubkey.toBase58(),
      signature: first?.signature ?? null,
      paidAt: first?.blockTime ? first.blockTime * 1000 : Date.now(),
    });
  }
  if (!fresh.length) return { added: 0, total: Object.keys(all).length };
  fresh.sort((a, b) => a.paidAt - b.paidAt || String(a.signature).localeCompare(String(b.signature)));
  let next = Object.values(all).reduce((m, r) => Math.max(m, r.ordinal), 0);
  for (const row of fresh) all[row.wallet] = { ordinal: ++next, ...row, recordedAt: Date.now() };
  save(PATH, all);
  return { added: fresh.length, total: Object.keys(all).length };
}

/**
 * Founders exported from a previous deployment (devnet beta → mainnet).
 * FOUNDER_SNAPSHOT points at a JSON array of { wallet, ordinal } written by scripts/founders-snapshot.mjs.
 */
let snapshot = null;
export function snapshotFounder(wallet) {
  if (!process.env.FOUNDER_SNAPSHOT) return null;
  if (!snapshot) {
    try {
      const rows = JSON.parse(readFileSync(process.env.FOUNDER_SNAPSHOT, "utf8"));
      snapshot = new Map(rows.map((r) => [r.wallet, r]));
    } catch (e) {
      console.error(`FOUNDER_SNAPSHOT unreadable: ${e.message}`);
      snapshot = new Map();
    }
  }
  return snapshot.get(wallet) ?? null;
}

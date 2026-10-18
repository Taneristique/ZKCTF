/**
 * Finisher loyalty token: a soulbound (Token-2022 NonTransferable) token, decimals 0.
 * Every wallet that clears all CTFs of a round while it is live receives 1 token after settle,
 * so the balance is the number of rounds the wallet has finished. It has no cash value, cannot be
 * transferred or sold, and only unlocks community perks (see PERKS).
 *
 * When on-chain Entry PDAs are empty at settle (k=0), host full-clears are still minted
 * automatically, and players can claim any missed mint via /loyalty/claim (wallet signature).
 */
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  ExtensionType,
  LENGTH_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TYPE_SIZE,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createInitializeNonTransferableMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMintLen,
} from "@solana/spl-token";
import { createInitializeInstruction, pack } from "@solana/spl-token-metadata";
import { dataPath, load, save } from "./store.js";
import { sendAndConfirm } from "./chain.js";
import { hostFinishedRounds, rankSolversUnix, inferLevelCount } from "./solves.js";
import { weekNftsFor } from "./weekNft.js";

const PATH = dataPath("loyalty.json");
const PER_TX = 4;
/** Round must be over this long before a player can claim a missed mint. */
const CLAIM_GRACE_S = 120;

/** Tier thresholds are rounds finished. Perk ids are translated on the frontend. */
export const TIERS = [
  { id: "elite", min: 12, perks: ["eliteEvents", "earlyLessons", "hallOfFame", "holderRole", "betaAccess"] },
  { id: "veteran", min: 4, perks: ["eliteEvents", "earlyLessons", "hallOfFame", "holderRole"] },
  { id: "finisher", min: 1, perks: ["eliteEvents", "hallOfFame", "holderRole"] },
];

export function loyaltyMint() {
  return process.env.LOYALTY_MINT ? new PublicKey(process.env.LOYALTY_MINT) : null;
}

export function tierFor(count) {
  return TIERS.find((t) => count >= t.min) ?? null;
}

export async function loyaltyCount(connection, wallet) {
  const mint = loyaltyMint();
  if (!mint) return 0;
  const ata = getAssociatedTokenAddressSync(mint, new PublicKey(wallet), false, TOKEN_2022_PROGRAM_ID);
  try {
    const { value } = await connection.getTokenAccountBalance(ata);
    return Number(value.amount);
  } catch {
    return 0;
  }
}

export async function loyaltyStatus(connection, wallet) {
  const count = await loyaltyCount(connection, wallet);
  const tier = tierFor(count);
  const claimable = claimableFinisherRounds(wallet);
  return {
    mint: loyaltyMint()?.toBase58() ?? null,
    count,
    tier: tier?.id ?? null,
    perks: tier?.perks ?? [],
    next: [...TIERS].reverse().find((t) => t.min > count) ?? null,
    claimable,
    hostFinishes: hostFinishedRounds(wallet).length,
  };
}

function roundRow(roundKey, wallet) {
  return load(PATH)[String(roundKey)]?.[wallet] ?? null;
}

export function isLoyaltyMinted(roundKey, wallet) {
  const row = roundRow(roundKey, wallet);
  return row?.status === "ok" || row?.status === "sent";
}

/** Host + week-board wallets that earned a Finisher for this round. */
export function hostFinishersForRound(roundKey, levelCount) {
  const key = Number(roundKey);
  const iso = new Date(key * 1000).toISOString();
  const n = Number(levelCount) || inferLevelCount(iso) || 0;
  const fromSolves = rankSolversUnix(key, n).map((r) => r.wallet);
  const nfts = load(dataPath("week-nfts.json"))[String(roundKey)] ?? {};
  return [...new Set([...fromSolves, ...Object.keys(nfts)])];
}

/** Rounds this wallet finished on host but has not received an on-chain Finisher mint for. */
export function claimableFinisherRounds(wallet) {
  if (!wallet || !loyaltyMint()) return [];
  const nowS = Math.floor(Date.now() / 1000);
  const out = [];
  const seen = new Set();

  for (const r of hostFinishedRounds(wallet)) {
    if (seen.has(r.round)) continue;
    seen.add(r.round);
    if (nowS < r.round + 24 * 3600 + CLAIM_GRACE_S) continue; // still live / grace
    if (isLoyaltyMinted(r.round, wallet)) continue;
    out.push({
      round: r.round,
      day: new Date(r.round * 1000).toISOString().slice(0, 10),
      status: "claimable",
      reason: "host-full-clear",
    });
  }

  for (const n of weekNftsFor(wallet)) {
    const rk = Number(n.round);
    if (!rk || seen.has(rk)) continue;
    seen.add(rk);
    if (nowS < rk + 24 * 3600 + CLAIM_GRACE_S) continue;
    if (isLoyaltyMinted(rk, wallet)) continue;
    out.push({
      round: rk,
      day: new Date(rk * 1000).toISOString().slice(0, 10),
      status: "claimable",
      reason: "week-board",
    });
  }

  return out.sort((a, b) => b.round - a.round);
}

/** One-time: create the soulbound mint with on-chain metadata. Mint + update authority = `authority`. */
export async function createLoyaltyMint(connection, authority, { name, symbol, uri }) {
  const mint = Keypair.generate();
  const metadata = {
    mint: mint.publicKey,
    name,
    symbol,
    uri,
    updateAuthority: authority.publicKey,
    additionalMetadata: [],
  };
  const mintLen = getMintLen([ExtensionType.NonTransferable, ExtensionType.MetadataPointer]);
  const metaLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metaLen);
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: authority.publicKey,
      newAccountPubkey: mint.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeNonTransferableMintInstruction(mint.publicKey, TOKEN_2022_PROGRAM_ID),
    createInitializeMetadataPointerInstruction(mint.publicKey, authority.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID),
    createInitializeMintInstruction(mint.publicKey, 0, authority.publicKey, null, TOKEN_2022_PROGRAM_ID),
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      mint: mint.publicKey,
      metadata: mint.publicKey,
      mintAuthority: authority.publicKey,
      updateAuthority: authority.publicKey,
      name,
      symbol,
      uri,
    }),
  );
  const sig = await sendAndConfirm(connection, tx, [authority, mint]);
  return { mint: mint.publicKey.toBase58(), signature: sig };
}

/**
 * Mint 1 token to every finisher of `roundKey` exactly once. Progress is written before and after each
 * send, and a sent-but-unconfirmed batch is checked on chain before it is ever re-sent, so retries
 * after a crash or RPC timeout cannot double-mint.
 */
export async function awardRound(connection, authority, roundKey, wallets) {
  const mint = loyaltyMint();
  if (!mint) return { skipped: "LOYALTY_MINT not set", minted: 0, total: 0 };
  const list = [...new Set((wallets ?? []).filter(Boolean))];
  if (!list.length) return { minted: 0, total: 0, finishers: 0 };
  const all = load(PATH);
  const round = (all[String(roundKey)] ??= {});
  for (const [w, row] of Object.entries(round)) {
    if (row.status !== "sent") continue;
    const { value } = await connection.getSignatureStatus(row.sig, { searchTransactionHistory: true });
    if (value && !value.err && value.confirmationStatus) round[w] = { ...row, status: "ok" };
    else if (Date.now() - row.at > 180_000) delete round[w];
  }
  // Drop failed / claiming stubs so we can retry; keep ok + in-flight sent.
  for (const w of list) {
    const st = round[w]?.status;
    if (st && st !== "ok" && st !== "sent") delete round[w];
  }
  save(PATH, all);
  const pending = list.filter((w) => !round[w]);
  let minted = 0;
  for (let i = 0; i < pending.length; i += PER_TX) {
    const batch = pending.slice(i, i + PER_TX);
    const tx = new Transaction();
    for (const w of batch) {
      const owner = new PublicKey(w);
      const ata = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID);
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, ata, owner, mint, TOKEN_2022_PROGRAM_ID),
        createMintToInstruction(mint, ata, authority.publicKey, 1, [], TOKEN_2022_PROGRAM_ID),
      );
    }
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    tx.feePayer = authority.publicKey;
    tx.recentBlockhash = blockhash;
    tx.sign(authority);
    const sig = await connection.sendRawTransaction(tx.serialize());
    for (const w of batch) round[w] = { sig, status: "sent", at: Date.now(), source: "award" };
    save(PATH, all);
    const res = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    if (res.value.err) {
      for (const w of batch) delete round[w];
      save(PATH, all);
      throw new Error(`loyalty mint failed: ${JSON.stringify(res.value.err)}`);
    }
    for (const w of batch) round[w].status = "ok";
    save(PATH, all);
    minted += batch.length;
  }
  return { minted, total: Object.keys(round).length, finishers: list.length };
}

/**
 * Mint Finisher for host (+ optional on-chain) finishers of a settled round.
 * Safe to call repeatedly.
 */
export async function reconcileLoyaltyRound(connection, authority, roundKey, { levelCount, onChainWallets = [] } = {}) {
  const finishers = [
    ...new Set([...(onChainWallets ?? []), ...hostFinishersForRound(roundKey, levelCount)]),
  ];
  if (!finishers.length) return { ok: true, minted: 0, finishers: 0, round: Number(roundKey) };
  const out = await awardRound(connection, authority, String(roundKey), finishers);
  return { ok: true, round: Number(roundKey), ...out, finishers: finishers.length };
}

/**
 * Player-initiated mint for one missed Finisher round (wallet must have host full-clear).
 */
export async function executeFinisherClaim({ connection, authority, wallet, roundKey }) {
  const mint = loyaltyMint();
  if (!mint) return { ok: false, error: "Finisher mint is not configured." };
  const rk = Number(roundKey);
  if (!Number.isFinite(rk) || rk <= 0) return { ok: false, error: "Invalid round." };
  const nowS = Math.floor(Date.now() / 1000);
  if (nowS < rk + 24 * 3600 + CLAIM_GRACE_S) {
    return { ok: false, error: "Round is still live — Finisher mints after the window ends." };
  }
  if (isLoyaltyMinted(rk, wallet)) {
    return { ok: false, error: "Finisher already minted for this round." };
  }
  const eligible = claimableFinisherRounds(wallet).some((c) => c.round === rk);
  if (!eligible) {
    // Re-check host board directly (claimable list may race with new solves).
    const hosts = hostFinishersForRound(rk);
    if (!hosts.includes(wallet)) {
      return { ok: false, error: "No host full-clear recorded for this round." };
    }
  }

  const all = load(PATH);
  const round = (all[String(rk)] ??= {});
  if (round[wallet]?.status === "claiming" && Date.now() - (round[wallet].at ?? 0) < 120_000) {
    return { ok: false, error: "Mint already in progress. Wait a moment." };
  }
  round[wallet] = { status: "claiming", at: Date.now(), source: "claim" };
  save(PATH, all);

  try {
    const out = await awardRound(connection, authority, String(rk), [wallet]);
    if (!isLoyaltyMinted(rk, wallet)) {
      const fresh = load(PATH);
      if (fresh[String(rk)]?.[wallet]?.status === "claiming") {
        delete fresh[String(rk)][wallet];
        save(PATH, fresh);
      }
      return { ok: false, error: out.skipped || "Mint did not complete." };
    }
    const row = load(PATH)[String(rk)]?.[wallet];
    return {
      ok: true,
      round: rk,
      sig: row?.sig ?? null,
      count: await loyaltyCount(connection, wallet),
      note: "Finisher token minted to your wallet.",
    };
  } catch (e) {
    const fresh = load(PATH);
    if (fresh[String(rk)]?.[wallet]?.status === "claiming") {
      delete fresh[String(rk)][wallet];
      save(PATH, fresh);
    }
    return { ok: false, error: String(e.message ?? e) };
  }
}

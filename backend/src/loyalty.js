/**
 * Finisher loyalty token: a soulbound (Token-2022 NonTransferable) token, decimals 0.
 * Every wallet that clears all CTFs of a round while it is live receives 1 token after settle,
 * so the balance is the number of rounds the wallet has finished. It has no cash value, cannot be
 * transferred or sold, and only unlocks community perks (see PERKS).
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

const PATH = dataPath("loyalty.json");
const PER_TX = 4;

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
  return {
    mint: loyaltyMint()?.toBase58() ?? null,
    count,
    tier: tier?.id ?? null,
    perks: tier?.perks ?? [],
    next: [...TIERS].reverse().find((t) => t.min > count) ?? null,
  };
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
  if (!mint) return { skipped: "LOYALTY_MINT not set" };
  const all = load(PATH);
  const round = (all[roundKey] ??= {});
  for (const [w, row] of Object.entries(round)) {
    if (row.status !== "sent") continue;
    const { value } = await connection.getSignatureStatus(row.sig, { searchTransactionHistory: true });
    if (value && !value.err && value.confirmationStatus) round[w] = { ...row, status: "ok" };
    else if (Date.now() - row.at > 180_000) delete round[w];
  }
  save(PATH, all);
  const todo = wallets.filter((w) => !round[w]);
  let minted = 0;
  for (let i = 0; i < todo.length; i += PER_TX) {
    const batch = todo.slice(i, i + PER_TX);
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
    for (const w of batch) round[w] = { sig, status: "sent", at: Date.now() };
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
  return { minted, total: Object.keys(round).length };
}
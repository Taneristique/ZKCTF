/**
 * Week-winner soulbound NFTs (Token-2022 NonTransferable).
 * After settle, each top-N winner gets a unique mint for that round (rank + wallet in metadata).
 * Transferable collections are deferred on purpose (Lock G / no speculative reward token).
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
import { displayName } from "./profiles.js";

const PATH = dataPath("week-nfts.json");
const PUBLIC_BASE = () => (process.env.PUBLIC_API_URL ?? process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

function db() {
  return load(PATH);
}

export function weekNftsFor(wallet) {
  const all = db();
  const out = [];
  for (const [roundKey, winners] of Object.entries(all)) {
    const row = winners[wallet];
    if (row) out.push({ round: Number(roundKey), ...row });
  }
  return out.sort((a, b) => b.round - a.round);
}

export function weekMeta(roundKey) {
  const winners = db()[String(roundKey)] ?? {};
  const list = Object.entries(winners).map(([wallet, row]) => ({
    wallet,
    rank: row.rank,
    pseudonym: row.pseudonym,
    mint: row.mint,
  }));
  list.sort((a, b) => a.rank - b.rank);
  const startIso = Number.isFinite(Number(roundKey))
    ? new Date(Number(roundKey) * 1000).toISOString()
    : String(roundKey);
  return {
    name: `ZKCTF Week Winner`,
    symbol: "ZKWIN",
    description: `Soulbound week-winner badge for the ZKCTF Saturday race starting ${startIso}. Non-transferable. No cash value.`,
    image: `${PUBLIC_BASE()}/week-nft/art.svg`,
    external_url: `${PUBLIC_BASE() || "https://zkctf.com"}`,
    attributes: [
      { trait_type: "round_start", value: startIso },
      { trait_type: "winners", value: list.length },
    ],
    winners: list,
  };
}

async function createWinnerMint(connection, authority, { name, symbol, uri }) {
  const mint = Keypair.generate();
  const metadata = {
    mint: mint.publicKey,
    name: name.slice(0, 32),
    symbol: symbol.slice(0, 10),
    uri: uri.slice(0, 200),
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
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
    }),
  );
  const sig = await sendAndConfirm(connection, tx, [authority, mint]);
  return { mint: mint.publicKey, signature: sig };
}

/**
 * Mint one unique soulbound NFT per winner. Idempotent via week-nfts.json.
 * `winners` = ordered wallet list (rank 1 = index 0).
 */
export async function awardWeekWinners(connection, authority, roundKey, winners) {
  const key = String(roundKey);
  const all = db();
  const round = (all[key] ??= {});
  const base = PUBLIC_BASE();
  let minted = 0;
  for (let i = 0; i < winners.length; i++) {
    const wallet = winners[i];
    if (round[wallet]?.status === "ok") continue;
    const rank = i + 1;
    const pseudo = displayName(wallet);
    const short = pseudo.length > 12 ? `${pseudo.slice(0, 12)}` : pseudo;
    const name = `ZK W${String(roundKey).slice(-4)} #${rank} ${short}`.slice(0, 32);
    const uri = base
      ? `${base}/week-nft/meta/${key}/${wallet}.json`
      : `https://zkctf.com/week/${key}/${rank}`;
    const { mint, signature: createSig } = await createWinnerMint(connection, authority, {
      name,
      symbol: "ZKWIN",
      uri,
    });
    const owner = new PublicKey(wallet);
    const ata = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID);
    const tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, ata, owner, mint, TOKEN_2022_PROGRAM_ID),
      createMintToInstruction(mint, ata, authority.publicKey, 1, [], TOKEN_2022_PROGRAM_ID),
    );
    const sig = await sendAndConfirm(connection, tx, [authority]);
    round[wallet] = {
      rank,
      pseudonym: pseudo,
      mint: mint.toBase58(),
      createSig,
      sig,
      status: "ok",
      at: Date.now(),
    };
    save(PATH, all);
    minted++;
  }
  return { minted, total: Object.keys(round).length };
}

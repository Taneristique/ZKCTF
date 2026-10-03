import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { createHash } from "node:crypto";

export const PROGRAM_ID = new PublicKey(
  process.env.ZKCTF_PROGRAM_ID ?? "34Kut3tQ4HTJMF2gVvnT6shhmenPE6463xnGk5sxDtz7",
);

export function disc(name) {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);
/** Devnet Circle USDC — must match programs/zkctf USDC_MINT. */
export const USDC_MINT = new PublicKey(
  process.env.USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

export function ata(owner, mint = USDC_MINT) {
  return PublicKey.findProgramAddressSync(
    [new PublicKey(owner).toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

export function potVaultPda() {
  return pda([Buffer.from("pot")]);
}

export function potAta() {
  if (process.env.POT_USDC_ATA) return new PublicKey(process.env.POT_USDC_ATA);
  const [vault] = potVaultPda();
  return ata(vault);
}

export function pda(seeds) {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
}

export function configPda() {
  return pda([Buffer.from("config")]);
}

export function seatPda(wallet) {
  return pda([Buffer.from("seat"), new PublicKey(wallet).toBuffer()]);
}

export function roundPda() {
  return pda([Buffer.from("round")]);
}

export function entryPda(wallet) {
  return pda([Buffer.from("entry"), new PublicKey(wallet).toBuffer()]);
}

function u8(n) {
  return Buffer.from([n]);
}

function i64(n) {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(BigInt(n));
  return b;
}

/** Seat PDA: disc(8) + wallet(32) + tier(u8) + expiry(i64) + slots + prompts_used + sku_months + bump. */
export const SEAT_SPACE = 8 + 32 + 1 + 8 + 1 + 1 + 1 + 1;
export const SEAT_TIER_OFFSET = 40;

export function parseSeat(data) {
  if (!data || data.length < SEAT_SPACE) return null;
  return {
    wallet: new PublicKey(data.subarray(8, 40)).toBase58(),
    tier: data[SEAT_TIER_OFFSET],
    expiry: Number(data.readBigInt64LE(41)),
    months: data[51],
  };
}

/** SPL Associated Token Account "create idempotent" (no-op if it already exists). */
export function createAtaIdempotentIx({ payer, owner, mint = USDC_MINT }) {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: new PublicKey(payer), isSigner: true, isWritable: true },
      { pubkey: ata(owner, mint), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(owner), isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
}

/** SPL Token Transfer (instruction 3). */
export function tokenTransferIx({ source, dest, owner, atoms }) {
  const data = Buffer.alloc(9);
  data[0] = 3;
  data.writeBigUInt64LE(BigInt(atoms), 1);
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: new PublicKey(source), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(dest), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(owner), isSigner: true, isWritable: false },
    ],
    data,
  });
}

export function mintSeatIx({ payer, wallet, authority, tier, months, slots }) {
  const [config] = configPda();
  const [seat] = seatPda(wallet);
  const data = Buffer.concat([disc("mint_seat"), u8(tier), u8(months), u8(slots), u8(0)]);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: new PublicKey(payer), isSigner: true, isWritable: true },
      { pubkey: new PublicKey(wallet), isSigner: true, isWritable: false },
      { pubkey: new PublicKey(authority), isSigner: true, isWritable: false },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: seat, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function submitIx({ player, level, commit, proofA, proofB, proofC }) {
  const [entry] = entryPda(player);
  const [round] = roundPda();
  const data = Buffer.concat([
    disc("submit"),
    u8(level),
    Buffer.from(commit),
    Buffer.from(proofA),
    Buffer.from(proofB),
    Buffer.from(proofC),
  ]);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: new PublicKey(player), isSigner: true, isWritable: true },
      { pubkey: entry, isSigner: false, isWritable: true },
      { pubkey: round, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function createRoundIx({ payer, authority, start, end, levelCount, commitments }) {
  const [config] = configPda();
  const [round] = roundPda();
  const pads = Buffer.alloc(32 * 8);
  for (let i = 0; i < 8; i++) {
    const c = commitments[i] ?? Buffer.alloc(32);
    Buffer.from(c).copy(pads, i * 32, 0, 32);
  }
  const data = Buffer.concat([
    disc("create_round"),
    i64(start),
    i64(end),
    u8(levelCount),
    pads,
  ]);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: new PublicKey(payer), isSigner: true, isWritable: true },
      { pubkey: new PublicKey(authority), isSigner: true, isWritable: false },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: round, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function enterRoundIx({ player, playerAta, potUsdcAta }) {
  const [round] = roundPda();
  const [entry] = entryPda(player);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: new PublicKey(player), isSigner: true, isWritable: true },
      { pubkey: round, isSigner: false, isWritable: true },
      { pubkey: entry, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(playerAta), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(potUsdcAta), isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: disc("enter_round"),
  });
}

export function settleIx({ authority, treasuryAta, winnerAtas, k }) {
  const [config] = configPda();
  const [round] = roundPda();
  const [vault] = potVaultPda();
  const pot = potAta();
  const keys = [
    { pubkey: new PublicKey(authority), isSigner: true, isWritable: false },
    { pubkey: config, isSigner: false, isWritable: false },
    { pubkey: round, isSigner: false, isWritable: true },
    { pubkey: pot, isSigner: false, isWritable: true },
    { pubkey: vault, isSigner: false, isWritable: false },
    { pubkey: new PublicKey(treasuryAta), isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];
  for (const a of winnerAtas.slice(0, k)) {
    keys.push({ pubkey: new PublicKey(a), isSigner: false, isWritable: true });
  }
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: Buffer.concat([disc("settle"), u8(k)]),
  });
}

export async function recentTx(connection, feePayer) {
  const tx = new Transaction();
  tx.feePayer = new PublicKey(feePayer);
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  return tx;
}

/**
 * Preconditions for enter_round on the configured RPC.
 * Returns a human reason string, or null if a wallet can try signing.
 */
export async function enterChainBlockers(connection) {
  const prog = await connection.getAccountInfo(PROGRAM_ID);
  if (!prog || !prog.executable) {
    return `Program ${PROGRAM_ID.toBase58()} is not deployed (or not executable) on this RPC. Build + deploy, then create_round.`;
  }
  const [round] = roundPda();
  if (!(await connection.getAccountInfo(round))) {
    return `Round PDA missing (${round.toBase58()}). Run: CHAIN_DEPLOY=1 node scripts/weekly-challenge-bot.mjs`;
  }
  const pot = potAta();
  if (!(await connection.getAccountInfo(pot))) {
    return `Pot USDC ATA missing (${pot.toBase58()}). Create the vault ["pot"] ATA for mint ${USDC_MINT.toBase58()}.`;
  }
  return null;
}

/** Entry PDA: disc(8) + wallet(32) + round_start(i64) + solved_mask(u8) + last_ts(i64) + bump(1). */
export const ENTRY_SPACE = 8 + 32 + 8 + 1 + 8 + 1;

export function parseEntry(data) {
  if (!data || data.length < ENTRY_SPACE) return null;
  return {
    wallet: new PublicKey(data.subarray(8, 40)).toBase58(),
    roundStart: Number(data.readBigInt64LE(40)),
    solvedMask: data[48],
    lastTs: Number(data.readBigInt64LE(49)),
  };
}

/** Round PDA: disc(8) + start(i64) + … */
export async function onChainRoundStart(connection) {
  const info = await connection.getAccountInfo(roundPda()[0]);
  if (!info || !info.owner.equals(PROGRAM_ID) || info.data.length < 16) return null;
  return Number(info.data.readBigInt64LE(8));
}

/** Entry row for this wallet in the current on-chain round, or null. */
export async function entryForRound(connection, wallet) {
  const roundStart = await onChainRoundStart(connection);
  if (roundStart == null) return null;
  const info = await connection.getAccountInfo(entryPda(wallet)[0]);
  if (!info || !info.owner.equals(PROGRAM_ID)) return null;
  const row = parseEntry(info.data);
  return row && row.roundStart === roundStart ? row : null;
}

/**
 * Lock A: payout ranking from on-chain Groth16 progress (Entry.solved_mask) only.
 * Candidate wallets come from host entry index; no full mask ⇒ not a winner.
 */
export async function rankClearsOnChain(connection, wallets, levelCount) {
  const n = Number(levelCount) || 0;
  if (n <= 0 || n > 8) return [];
  const roundStart = await onChainRoundStart(connection);
  if (roundStart == null) return [];
  const full = (1 << n) - 1;
  const out = [];
  for (let i = 0; i < wallets.length; i += 100) {
    const batch = wallets.slice(i, i + 100);
    const infos = await connection.getMultipleAccountsInfo(batch.map((w) => entryPda(w)[0]));
    infos.forEach((info, j) => {
      if (!info || !info.owner.equals(PROGRAM_ID)) return;
      const row = parseEntry(info.data);
      if (!row || row.roundStart !== roundStart || row.solvedMask !== full) return;
      out.push({ wallet: batch[j], cleared: true, time: row.lastTs * 1000, source: "on-chain" });
    });
  }
  return out.sort((a, b) => a.time - b.time);
}

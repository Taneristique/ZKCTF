import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "34Kut3tQ4HTJMF2gVvnT6shhmenPE6463xnGk5sxDtz7",
);

export const USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

/** Sum of the wallet's balances for `mint` across all its token accounts (UI units). */
export async function tokenBalance(connection: Connection, owner: PublicKey, mint = USDC_MINT) {
  const { value } = await connection.getParsedTokenAccountsByOwner(owner, { mint });
  return value.reduce((sum, a) => sum + Number(a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
}

const SUBMIT = Uint8Array.from([88, 166, 102, 181, 162, 127, 170, 48]);

const enc = new TextEncoder();

export function seatPda(wallet: PublicKey) {
  return PublicKey.findProgramAddressSync([enc.encode("seat"), wallet.toBuffer()], PROGRAM_ID);
}

export function entryPda(wallet: PublicKey) {
  return PublicKey.findProgramAddressSync([enc.encode("entry"), wallet.toBuffer()], PROGRAM_ID);
}

export function roundPda() {
  return PublicKey.findProgramAddressSync([enc.encode("round")], PROGRAM_ID);
}

function hexToBytes(hex: string) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function submitInstruction(args: {
  player: PublicKey;
  level: number;
  commit: Uint8Array;
  proofA: Uint8Array;
  proofB: Uint8Array;
  proofC: Uint8Array;
}) {
  const [entry] = entryPda(args.player);
  const [round] = roundPda();
  const data = new Uint8Array(
    8 + 1 + args.commit.length + args.proofA.length + args.proofB.length + args.proofC.length,
  );
  data.set(SUBMIT, 0);
  data[8] = args.level;
  let o = 9;
  data.set(args.commit, o);
  o += args.commit.length;
  data.set(args.proofA, o);
  o += args.proofA.length;
  data.set(args.proofB, o);
  o += args.proofB.length;
  data.set(args.proofC, o);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: args.player, isSigner: true, isWritable: true },
      { pubkey: entry, isSigner: false, isWritable: true },
      { pubkey: round, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

export { hexToBytes };

/** Prefer wallet.sendTransaction so Wallet Standard gets chain=solana:devnet (signTransaction alone defaults to mainnet in Phantom). */
export async function sendB64Tx(
  connection: Connection,
  sendTransaction: (tx: Transaction, connection: Connection) => Promise<string>,
  b64: string,
) {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const tx = Transaction.from(raw);
  try {
    return await sendTransaction(tx, connection);
  } catch (e) {
    const err = e as { message?: string; logs?: string[]; error?: { message?: string } };
    const logs = Array.isArray(err.logs) ? err.logs.slice(-4).join(" · ") : "";
    const base = err.message || err.error?.message || "Wallet send failed";
    throw new Error(logs ? `${base} (${logs})` : base);
  }
}

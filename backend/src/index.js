import "dotenv/config";
import cors from "cors";
import express from "express";
import { Connection, PublicKey } from "@solana/web3.js";
import { recordSolve, rankSolvers, canAttempt, progress as solveProgress } from "./solves.js";
import { publicLevels, levelById, readRound, roundOpen } from "./roundStore.js";
import { getEntry, putEntry, listEntries, lessonSolves, recordLessonSolve } from "./store.js";
import { ENTRY_USDC, N_WINNERS, CLUSTER, ASSET, TREASURY_BPS, WEIGHTS, example, saturdayWindow } from "./race.js";
import { founders, founderFor, syncFounders, snapshotFounder } from "./founders.js";
import { loyaltyStatus, TIERS } from "./loyalty.js";
import { startScheduler } from "./scheduler.js";
import { authorityKeypair, authoritySource } from "./authority.js";
import {
  FOUNDING,
  memberStatus,
  foundingOffer,
  planTable,
  buildCheckoutTx,
  treasuryOwner,
  holdFoundingSeat,
  releaseFoundingSeat,
} from "./membership.js";
import { TRACKS, lessonCatalog, lessonFor, lessonFlag } from "./lessons.js";
import { walletFromRequest } from "./walletAuth.js";
import {
  recentTx,
  PROGRAM_ID,
  enterRoundIx,
  ata,
  potAta,
  USDC_MINT,
  entryForRound,
  rankClearsOnChain,
  enterChainBlockers,
  onChainAuthority,
} from "./chain.js";
import { flagsEqual, hex32, fromHex } from "./relation.mjs";
import { artifactsReady, groth16Proof, buildC } from "./prove.js";
import { awardSolve, getPrestige } from "./prestige.js";

const PORT = Number(process.env.PORT ?? 8787);
const RPC = process.env.SOLANA_RPC ?? "https://api.devnet.solana.com";
const connection = new Connection(RPC, "confirmed");
const authority = authorityKeypair();
const WINDOW = process.env.ROUND_WINDOW ?? "open";

let trustedAuthority = null;
/** The server key must equal the authority stored in the program config, or co-signed txs fail with custom error 0x3. */
async function authorityStatus() {
  if (!trustedAuthority) {
    try {
      trustedAuthority = await onChainAuthority(connection);
    } catch {
      trustedAuthority = null;
    }
  }
  const server = authority.publicKey.toBase58();
  return {
    ok: trustedAuthority === server,
    server,
    onChain: trustedAuthority,
    source: authoritySource(),
  };
}

const PAYMENTS_PAUSED =
  "Payments are paused: the server signing key does not match the program authority. Nothing was charged. Please try again later.";

const app = express();
app.use(cors({ origin: true }));

app.get("/health", async (_req, res) => {
  const auth = await authorityStatus();
  res.json({
    ok: true,
    product: "ZKCTF",
    membership: "usdc",
    rpc: RPC,
    program: PROGRAM_ID.toBase58(),
    authority: auth.server,
    authorityOnChain: auth.onChain,
    authorityOk: auth.ok,
    authoritySource: auth.source,
    groth16: artifactsReady(),
    window: WINDOW,
    entryUsdc: ENTRY_USDC,
    asset: ASSET,
    nWinners: N_WINNERS,
    treasuryBps: TREASURY_BPS,
    cluster: CLUSTER,
    linearCtf: true,
  });
});

app.get("/round", (_req, res) => {
  const stored = readRound();
  res.json({
    ...windowMeta(),
    levels: publicLevels(),
    locked: !roundOpen(stored),
    levelCount: stored.levels.length,
    source: stored.source,
    roundStart: stored.start,
    roundEnd: stored.end,
  });
});

app.get("/round/levels", (_req, res) => {
  res.json({ levels: publicLevels() });
});

app.get("/leaderboard", async (_req, res) => {
  const meta = windowMeta();
  const levels = publicLevels();
  const preview = rankSolvers(meta.start, levels.length);
  let ranked = preview;
  let source = "host-preview";
  try {
    const wallets = listEntries(meta.start).map((e) => e.wallet);
    const onChain = await rankClearsOnChain(connection, wallets, levels.length);
    if (onChain.length) {
      ranked = onChain;
      source = "on-chain";
    }
  } catch {
    /* RPC optional for preview */
  }
  res.json({
    levels: levels.map((l) => ({ level: l.id, title: l.title })),
    ranked: ranked.slice(0, 25),
    nWinners: N_WINNERS,
    entryUsdc: ENTRY_USDC,
    asset: ASSET,
    treasuryBps: TREASURY_BPS,
    weights: WEIGHTS,
    rule: "linear",
    source,
    payoutSource: "on-chain Groth16 submit PDAs + settle/split_pot",
    note: "Only wallets that clear every CTF this week can win. Ranked by finish time. Top N share 80%. Host-preview is not the payout source.",
  });
});

app.get("/progress/:wallet", (req, res) => {
  const meta = windowMeta();
  const levels = publicLevels();
  const p = solveProgress(req.params.wallet, meta.start, levels.length);
  res.json({
    ...p,
    entered: Boolean(getEntry(req.params.wallet, meta.start)),
    start: meta.start,
  });
});

app.get("/payout", (req, res) => {
  const entries = Math.max(0, Number(req.query.entries ?? 10));
  const solvers = Math.max(0, Number(req.query.solvers ?? 10));
  res.json({
    asset: ASSET,
    entryUsdc: ENTRY_USDC,
    nWinners: N_WINNERS,
    treasuryBps: TREASURY_BPS,
    weights: WEIGHTS,
    example: example(entries, solvers),
    samples: [example(1, 1), example(3, 2), example(20, 15), example(4, 0)],
  });
});

app.get("/solana/health", async (_req, res) => {
  try {
    const slot = await connection.getSlot();
    const version = await connection.getVersion();
    res.json({ cluster: RPC, slot, version: version["solana-core"], program: PROGRAM_ID.toBase58() });
  } catch (e) {
    res.status(502).json({ error: String(e.message ?? e) });
  }
});

app.get("/solana/balance/:pubkey", async (req, res) => {
  try {
    const key = new PublicKey(req.params.pubkey);
    const lamports = await connection.getBalance(key);
    res.json({ pubkey: key.toBase58(), lamports, sol: lamports / 1e9 });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.get("/membership/:wallet", async (req, res) => {
  try {
    res.json(await memberStatus(connection, req.params.wallet));
  } catch (e) {
    res.status(502).json({ error: String(e.message ?? e) });
  }
});

/** Plans + Founding perk for an optional wallet (?wallet=). Prices in USDC. */
app.get("/plans", async (req, res) => {
  const wallet = req.query.wallet ? String(req.query.wallet) : null;
  try {
    const offer = await foundingOffer(connection, wallet);
    res.json({
      asset: ASSET,
      mint: USDC_MINT.toBase58(),
      treasury: treasuryOwner(authority).toBase58(),
      plans: planTable(false),
      foundingPlans: planTable(true),
      founding: {
        seats: FOUNDING.seats,
        taken: offer.taken,
        left: offer.left,
        discountBps: FOUNDING.discountBps,
        earlyAccessHours: FOUNDING.earlyAccessHours,
        eligible: offer.eligible,
        member: Boolean(offer.status?.founding),
        ordinal: (wallet && founderFor(wallet)?.ordinal) || offer.carried?.ordinal || null,
        carried: Boolean(offer.carried),
        carriedDiscount: offer.carriedDiscount,
      },
      member: offer.status,
    });
  } catch (e) {
    res.status(502).json({ error: String(e.message ?? e) });
  }
});

/** Build the USDC membership tx: transfer → treasury + authority-co-signed mint_seat. Wallet signs + sends. */
app.post("/checkout", express.json(), async (req, res) => {
  const wallet = String(req.body?.wallet ?? "");
  const months = Number(req.body?.months ?? 0);
  if (!wallet) {
    res.status(400).json({ error: "Connect a wallet first, then pick a plan." });
    return;
  }
  const auth = await authorityStatus();
  if (!auth.ok) {
    console.error(
      `checkout refused: server authority ${auth.server} (${auth.source}) != on-chain ${auth.onChain}. Set AUTHORITY_KEYPAIR_JSON.`,
    );
    res.status(503).json({ error: PAYMENTS_PAUSED });
    return;
  }
  try {
    const offer = await foundingOffer(connection, wallet);
    const founding = offer.eligible;
    const { tx, atoms, treasuryAta, mint } = await buildCheckoutTx({
      connection,
      authority,
      wallet,
      months,
      founding,
      tier: offer.tier,
    });
    const sim = await connection.simulateTransaction(tx);
    if (sim.value.err) {
      const logs = (sim.value.logs ?? []).join(" ");
      const reason = /custom program error: 0x3\b/.test(logs)
        ? PAYMENTS_PAUSED
        : /insufficient funds/i.test(logs)
        ? `Not enough USDC. You need ${atoms / 1e6} USDC (devnet: faucet.circle.com).`
        : /AccountNotFound|could not find account|invalid account data/i.test(logs + JSON.stringify(sim.value.err))
          ? `No USDC token account on this wallet. Get devnet USDC from faucet.circle.com first.`
          : `Simulation failed: ${(sim.value.logs ?? []).slice(-3).join(" · ") || JSON.stringify(sim.value.err)}`;
      res.status(400).json({ error: reason });
      return;
    }
    tx.partialSign(authority);
    if (offer.tier === 1 && !offer.status?.founding) holdFoundingSeat(wallet);
    res.json({
      tx: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
      months,
      founding,
      priceUsdc: atoms / 1e6,
      mint,
      treasuryAta,
      note: offer.carriedDiscount
        ? `Founder first-purchase price: ${atoms / 1e6} USDC for ${months} month(s). Renewals are at the regular price.`
        : founding
          ? `Founding member: ${atoms / 1e6} USDC for ${months} month(s). Price locked on renewals.`
          : `${atoms / 1e6} USDC for ${months} month(s).`,
    });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

/** Called by the frontend after a membership tx confirms: records the Founder number right away. */
app.post("/checkout/confirm", express.json(), async (req, res) => {
  const wallet = String(req.body?.wallet ?? "");
  try {
    await syncFounders(connection);
    releaseFoundingSeat(wallet);
    res.json({ founder: founderFor(wallet) });
  } catch (e) {
    res.status(502).json({ error: String(e.message ?? e) });
  }
});

/** Public, ordered Founding members list (also on chain as tier-1 seats). */
app.get("/founders", (_req, res) => {
  const rows = founders();
  res.json({
    seats: FOUNDING.seats,
    count: rows.length,
    founders: rows.map(({ ordinal, wallet, signature, paidAt }) => ({ ordinal, wallet, signature, paidAt })),
  });
});

app.get("/founders/:wallet", (req, res) => {
  const row = founderFor(req.params.wallet);
  const carried = snapshotFounder(req.params.wallet);
  res.json({ founder: Boolean(row || carried), ordinal: row?.ordinal ?? carried?.ordinal ?? null, carried: Boolean(carried) });
});

app.get("/loyalty/:wallet", async (req, res) => {
  try {
    res.json({ ...(await loyaltyStatus(connection, req.params.wallet)), tiers: TIERS });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.get("/bot/status", (_req, res) => {
  const stored = readRound();
  res.json({
    ...scheduler.status(),
    hostRound: { start: stored.start, end: stored.end, source: stored.source, levels: stored.levels.length },
  });
});

app.get("/entry/:wallet", (req, res) => {
  const meta = windowMeta();
  const row = getEntry(req.params.wallet, meta.start);
  res.json({
    entered: Boolean(row),
    entryUsdc: ENTRY_USDC,
    asset: ASSET,
    nWinners: N_WINNERS,
    cluster: CLUSTER,
    start: meta.start,
    end: meta.end,
    ...(row ?? {}),
  });
});

app.post("/enter", express.json(), async (req, res) => {
  const wallet = String(req.body?.wallet ?? "");
  if (!wallet) {
    res.status(400).json({ error: "Connect a wallet first." });
    return;
  }
  const meta = windowMeta();
  const row = putEntry(wallet, {
    usdc: ENTRY_USDC,
    asset: ASSET,
    start: meta.start,
    end: meta.end,
    demo: true,
    cluster: CLUSTER,
  });

  const chainEnter = process.env.ENABLE_CHAIN_ENTER !== "0";
  let txB64 = null;
  let chainNote = null;
  if (chainEnter) {
    try {
      const blocked = await enterChainBlockers(connection);
      if (blocked) {
        chainNote = `Host entry saved; on-chain USDC skipped — ${blocked}`;
      } else {
        const playerAta = ata(wallet);
        const pot = potAta();
        const ix = enterRoundIx({ player: wallet, playerAta, potUsdcAta: pot });
        const tx = await recentTx(connection, wallet);
        tx.add(ix);
        const sim = await connection.simulateTransaction(tx);
        if (sim.value.err) {
          const tip = (sim.value.logs ?? []).slice(-3).join(" · ") || JSON.stringify(sim.value.err);
          chainNote = `Host entry saved; enter_round simulation failed — ${tip}`;
        } else {
          txB64 = tx
            .serialize({ requireAllSignatures: false, verifySignatures: false })
            .toString("base64");
          chainNote = `Sign to move ${ENTRY_USDC} USDC into the pot. Host Play unlock is already saved.`;
        }
      }
    } catch (e) {
      chainNote = `Host entry saved; chain tx not built: ${String(e.message ?? e)}`;
    }
  }

  res.json({
    ok: true,
    demo: !txB64,
    entered: true,
    ...row,
    nWinners: N_WINNERS,
    tx: txB64,
    usdcMint: USDC_MINT.toBase58(),
    potAta: potAta().toBase58(),
    note:
      chainNote ??
      "5 USDC listed. On-chain enter moves USDC into the pot; this host also records entry for Play.",
  });
});

app.post("/prove-assist", express.json(), async (req, res) => {
  const wallet = String(req.body?.wallet ?? "");
  const levelId = Number(req.body?.level);
  const flag = String(req.body?.c ?? req.body?.flag ?? "");
  const nonceHex = String(req.body?.n ?? req.body?.nonce ?? "");
  const meta = windowMeta();
  const entered = getEntry(wallet, meta.start);
  if (!entered) {
    res.status(403).json({ error: "Enter this week’s race first." });
    return;
  }
  const level = levelById(levelId);
  if (!level) {
    res.status(400).json({ error: roundOpen() ? "Bad level." : "This round has not started yet." });
    return;
  }
  const gate = canAttempt(wallet, meta.start, levelId);
  if (!gate.ok) {
    res.status(403).json({
      error: `Clear CTF #${(gate.need ?? 0) + 1} before this one.`,
      need: gate.need,
    });
    return;
  }
  if (!flagsEqual(flag, level.flag)) {
    res.status(403).json({ error: "Wrong flag." });
    return;
  }
  const nonce = nonceHex ? fromHex(nonceHex) : Buffer.alloc(32, 2);
  const P = new PublicKey(wallet).toBytes();
  const play = buildC(P, flag, nonce);
  const out = {
    ok: true,
    level: levelId,
    h: level.h,
    C: hex32(play.C),
    delta: level.delta,
    nonce: hex32(play.nonce),
  };
  if (req.body?.prove !== false && artifactsReady()) {
    try {
      const proved = await groth16Proof({
        flag,
        deltaHex: level.delta,
        nonceHex: hex32(play.nonce),
        pubkey32: P,
      });
      out.proof = proved.solana;
      out.publicSignals = proved.publicSignals;
    } catch (e) {
      out.proveError = String(e.message ?? e);
    }
  }
  // Lock A: do not credit board / prestige until on-chain submit is confirmed
  // via POST /confirm-solve (reads Entry.solved_mask set by Groth16 submit).
  out.progress = solveProgress(wallet, meta.start, publicLevels().length);
  out.boardNote =
    "Progress and payout credit require on-chain Groth16 submit, then /confirm-solve.";
  res.json(out);
});

/** After wallet submits Groth16 verify tx — credit host progress only if the Entry bit is set. */
app.post("/confirm-solve", express.json(), async (req, res) => {
  const wallet = String(req.body?.wallet ?? "");
  const levelId = Number(req.body?.level);
  if (!wallet || Number.isNaN(levelId)) {
    res.status(400).json({ error: "wallet + level required." });
    return;
  }
  const meta = windowMeta();
  if (!getEntry(wallet, meta.start)) {
    res.status(403).json({ error: "Enter this week’s race first." });
    return;
  }
  try {
    const row = await entryForRound(connection, wallet);
    if (!row || levelId < 0 || levelId > 7 || !(row.solvedMask & (1 << levelId))) {
      res.status(409).json({
        ok: false,
        error: "Level not verified on-chain yet. Submit the Groth16 proof first.",
      });
      return;
    }
    const ts = row.lastTs;
    recordSolve(wallet, levelId, meta.start);
    const prestige = awardSolve(wallet, levelId, meta.start);
    const progress = solveProgress(wallet, meta.start, publicLevels().length);
    res.json({ ok: true, ts, prestige, progress, source: "on-chain" });
  } catch (e) {
    res.status(502).json({ error: String(e.message ?? e) });
  }
});

app.get("/prestige/:wallet", (req, res) => {
  res.json(getPrestige(req.params.wallet, windowMeta().start));
});

/**
 * Weekly Academy lessons (cybersecurity + math for cybersecurity). Full text needs an active USDC seat
 * and a wallet signature (walletAuth.js). ?wallet= alone only shows public seat status.
 */
app.get("/lessons", async (req, res) => {
  const authed = walletFromRequest(req);
  const viewer = authed ?? (req.query.wallet ? String(req.query.wallet) : null);
  try {
    const member = viewer ? await memberStatus(connection, viewer) : null;
    const solved = authed ? lessonSolves(authed) : {};
    const access = authed ? await withEarlyAccess(member, authed) : member && { ...member, founding: false };
    res.json({
      tracks: TRACKS,
      member,
      signedIn: Boolean(authed),
      lessons: lessonCatalog(access).map((l) => ({ ...l, solved: Boolean(solved[l.id]) })),
    });
  } catch (e) {
    res.status(502).json({ error: String(e.message ?? e) });
  }
});

app.get("/lessons/:id", async (req, res) => {
  const wallet = walletFromRequest(req);
  if (!wallet) {
    res.status(401).json({ error: "Sign in with your wallet to read lessons." });
    return;
  }
  try {
    const member = await withEarlyAccess(await memberStatus(connection, wallet), wallet);
    const out = lessonFor(req.params.id, member);
    if (out.error === 404) {
      res.status(404).json({ error: "Lesson not found." });
      return;
    }
    if (out.error === 403) {
      res.status(403).json({ error: "Academy membership required (paid in USDC).", lesson: out.lesson });
      return;
    }
    res.json({ lesson: out.lesson, solved: Boolean(lessonSolves(wallet)[req.params.id]) });
  } catch (e) {
    res.status(502).json({ error: String(e.message ?? e) });
  }
});

app.post("/lessons/:id/validate", express.json(), async (req, res) => {
  const wallet = walletFromRequest(req);
  const flag = String(req.body?.flag ?? "").trim();
  if (!wallet) {
    res.status(401).json({ error: "Sign in with your wallet to submit flags." });
    return;
  }
  try {
    const member = await memberStatus(connection, wallet);
    const out = lessonFor(req.params.id, member);
    if (out.error) {
      res.status(out.error).json({ error: out.error === 403 ? "Academy membership required." : "Lesson not found." });
      return;
    }
    const expected = lessonFlag(req.params.id);
    if (!flag || !expected || !flagsEqual(flag, expected)) {
      res.status(400).json({ error: "That flag doesn’t match. Try again." });
      return;
    }
    recordLessonSolve(wallet, req.params.id);
    res.json({ ok: true, solved: true });
  } catch (e) {
    res.status(502).json({ error: String(e.message ?? e) });
  }
});

/** Founding members and Veteran+ loyalty holders see lessons early (lessons.js reads `founding`). */
async function withEarlyAccess(member, wallet) {
  if (!member || member.founding) return member;
  const loyal = await loyaltyStatus(connection, wallet).catch(() => null);
  return loyal?.perks.includes("earlyLessons") ? { ...member, founding: true } : member;
}

const scheduler = startScheduler({ connection, authority, authorityStatus });

app.listen(PORT, "::", () => {
  console.log(`ZKCTF api [::]:${PORT} program=${PROGRAM_ID.toBase58()}`);
  void authorityStatus().then((a) => {
    if (a.ok) console.log(`authority ok ${a.server} (${a.source})`);
    else
      console.error(
        `AUTHORITY MISMATCH: server ${a.server} (${a.source}) vs on-chain ${a.onChain}. Payments are paused until AUTHORITY_KEYPAIR_JSON holds the on-chain authority key.`,
      );
  });
});

function windowMeta() {
  const { start, end, live } = saturdayWindow();
  return {
    mode: WINDOW === "open" ? "open" : "saturday",
    live,
    start: start.toISOString(),
    end: end.toISOString(),
    label: "Saturday 18:00 Istanbul / 12:00 Buenos Aires · 24 hours",
    entryUsdc: ENTRY_USDC,
    asset: ASSET,
    nWinners: N_WINNERS,
    treasuryBps: TREASURY_BPS,
    weights: WEIGHTS,
    cluster: CLUSTER,
  };
}

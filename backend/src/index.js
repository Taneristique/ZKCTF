import "dotenv/config";
import cors from "cors";
import express from "express";
import { Connection, PublicKey } from "@solana/web3.js";
import { recordSolve, rankSolvers, canAttempt, progress as solveProgress } from "./solves.js";
import { publicLevels, levelById, readRound, roundOpen } from "./roundStore.js";
import { getEntry, putEntry, listEntries, lessonSolves, recordLessonSolve, DATA_DIR, dataPath, load } from "./store.js";
import { dataPersistent } from "./dataDir.js";
import {
  ENTRY_USDC,
  ENTRY_ATOMS,
  N_WINNERS,
  CLUSTER,
  ASSET,
  TREASURY_BPS,
  WEIGHTS,
  example,
  saturdayWindow,
  splitPot,
} from "./race.js";
import { founders, founderFor, syncFounders, snapshotFounder, isExcludedFounder } from "./founders.js";
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
import { profileFor, setProfile, setEmoji, nameAvailable, namesFor, imageUrlsFor, emojisFor, displayName, walletForName } from "./profiles.js";
import { saveProfileImage, removeProfileImage, readProfileImage, MAX_BYTES } from "./profileImage.js";
import { AVATAR_EMOJIS } from "./avatarEmojis.js";
import { giftStatus, buildGiftTx, markGiftClaimed, GIFT_FINISHES, GIFT_MONTHS } from "./academyGift.js";
import { weekNftsFor, weekMeta } from "./weekNft.js";
import { claimsFor, claimableFor, executeClaim } from "./prizeClaims.js";
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
  explainEnterSimFailure,
  onChainAuthority,
  onChainRound,
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
  let founding = null;
  try {
    const offer = await foundingOffer(connection, null);
    founding = {
      seats: FOUNDING.seats,
      taken: offer.taken,
      left: offer.left,
      excludeEnv: Boolean(process.env.FOUNDING_EXCLUDE?.trim()),
      note: "FOUNDING_EXCLUDE wallets do not reduce left seats and are omitted from public founders",
    };
  } catch {
    founding = { error: "unavailable" };
  }
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
    founding,
    dataDir: DATA_DIR,
    dataPersistent,
    railwayVolume: process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim() || null,
    profiles: Object.keys(load(dataPath("profiles.json")).byWallet ?? {}).length,
    entries: Object.keys(load(dataPath("entries.json"))).length,
    reputation: (() => {
      const prestige = load(dataPath("prestige.json"));
      const weekNfts = load(dataPath("week-nfts.json"));
      const solves = load(dataPath("solves.json"));
      let placements = 0;
      for (const round of Object.values(weekNfts)) placements += Object.keys(round ?? {}).length;
      return {
        prestigeWallets: Object.keys(prestige).length,
        weekPlacements: placements,
        solveRows: Object.keys(solves).length,
        backupsDir: `${DATA_DIR}/backups`,
      };
    })(),
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
  let potAtoms = listEntries(meta.start).length * ENTRY_ATOMS;
  try {
    const wallets = listEntries(meta.start).map((e) => e.wallet);
    const onChain = await rankClearsOnChain(connection, wallets, levels.length);
    if (onChain.length) {
      ranked = onChain;
      source = "on-chain";
    }
    const round = await onChainRound(connection);
    if (round && round.start === meta.start) potAtoms = round.potAtoms || potAtoms;
  } catch {
    /* RPC optional for preview */
  }
  const top = ranked.slice(0, 25);
  const wallets = top.map((r) => r.wallet);
  const labels = namesFor(wallets);
  const images = imageUrlsFor(wallets);
  const emojis = emojisFor(wallets);
  const paidSlots = Math.min(top.length, N_WINNERS);
  const { pays, treasury } = splitPot(potAtoms, paidSlots);
  const paysUsdc = pays.map((a) => a / 1e6);
  res.json({
    levels: levels.map((l) => ({ level: l.id, title: l.title })),
    ranked: top.map((r, i) => {
      const place = i + 1;
      const prizeUsdc = i < paidSlots ? paysUsdc[i] : 0;
      return {
        ...r,
        place,
        pseudonym: labels[r.wallet] ?? null,
        displayName: labels[r.wallet] ?? displayName(r.wallet),
        imageUrl: images[r.wallet] ?? null,
        emoji: emojis[r.wallet] ?? null,
        prizeUsdc,
        paid: prizeUsdc > 0,
      };
    }),
    potUsdc: potAtoms / 1e6,
    treasuryUsdc: treasury / 1e6,
    prizePoolUsdc: (potAtoms - treasury) / 1e6,
    nWinners: N_WINNERS,
    entryUsdc: ENTRY_USDC,
    asset: ASSET,
    treasuryBps: TREASURY_BPS,
    weights: WEIGHTS,
    rule: "linear",
    source,
    payoutSource: "on-chain Groth16 submit PDAs + settle/split_pot",
    note: "Projected USDC from the current pot and finishers (same weights as settle). Final payout is on-chain only.",
  });
});

/** Pseudonym profile (independent of race entry / Academy). */
app.get("/profile/check/:name", (req, res) => {
  res.json(nameAvailable(req.params.name));
});

app.get("/profile/emojis", (_req, res) => {
  res.json({ emojis: AVATAR_EMOJIS });
});

/** Public Watson-style card: /u/:name → achievements (no private balances). */
app.get("/u/:name", async (req, res) => {
  const wallet = walletForName(req.params.name);
  if (!wallet) {
    res.status(404).json({ error: "No player with that pseudonym." });
    return;
  }
  const profile = profileFor(wallet);
  try {
    const meta = windowMeta();
    const levels = publicLevels();
    const [loyalty, founder, member, prestige] = await Promise.all([
      loyaltyStatus(connection, wallet),
      Promise.resolve(founderFor(wallet)),
      memberStatus(connection, wallet).catch(() => null),
      Promise.resolve(getPrestige(wallet, meta.start)),
    ]);
    const progress = solveProgress(wallet, meta.start, levels.length);
    const board = rankSolvers(meta.start, levels.length);
    const boardIdx = board.findIndex((r) => r.wallet === wallet);
    const liveWeek =
      boardIdx >= 0
        ? {
            place: boardIdx + 1,
            cleared: true,
            finishTime: board[boardIdx].time,
            source: "host-preview",
            projected: true,
            note: "Live board place. Settled rank and week-winner NFT appear after Saturday settle.",
          }
        : progress.cleared
          ? {
              place: null,
              cleared: true,
              finishTime: progress.finishTime,
              source: "host",
              projected: true,
              note: "Full clear on host; waiting for board sync / settle.",
            }
          : progress.solved.length > 0
            ? {
                place: null,
                cleared: false,
                solved: progress.solved.length,
                levelCount: levels.length,
                source: "host",
                projected: true,
              }
            : null;

    const nfts = weekNftsFor(wallet);
    const prizeClaims = claimsFor(wallet);
    const claimByRound = new Map(prizeClaims.map((c) => [Number(c.round), c]));
    // Merge week-nft placements + prize ledger so /u CV works even when NFT mint failed.
    const winMap = new Map();
    for (const n of nfts) {
      if (n.rank >= 1 && n.rank <= 10) winMap.set(Number(n.round), { ...n });
    }
    for (const c of prizeClaims) {
      const rk = Number(c.round);
      const prev = winMap.get(rk);
      if (!prev) {
        winMap.set(rk, {
          round: rk,
          rank: c.rank,
          prizeUsdc: c.prizeUsdc,
          at: c.at ?? c.claimedAt,
          mint: null,
          title: "ZKCTF Saturday race",
          host: { id: "zkctf", name: "ZKCTF", logo: "/logo.png" },
          claimStatus: c.status,
        });
      } else {
        winMap.set(rk, {
          ...prev,
          prizeUsdc: Number(prev.prizeUsdc) > 0 ? prev.prizeUsdc : c.prizeUsdc,
          rank: prev.rank || c.rank,
          claimStatus: c.status,
          claimSig: c.claimSig ?? prev.claimSig,
        });
      }
    }
    const wins = [...winMap.values()].sort((a, b) => Number(b.round) - Number(a.round));
    const firstPlaces = wins.filter((n) => n.rank === 1).length;
    const secondPlaces = wins.filter((n) => n.rank === 2).length;
    const thirdPlaces = wins.filter((n) => n.rank === 3).length;
    const payouts = wins.filter((n) => Number(n.prizeUsdc) > 0).length;
    const earnedUsdc = wins.reduce((s, n) => {
      const st = n.claimStatus || claimByRound.get(Number(n.round))?.status;
      if (st === "claimable" || st === "claiming") return s;
      return s + Number(n.prizeUsdc || 0);
    }, 0);
    const activity = wins.slice(0, 40).map((n) => {
      const claim = claimByRound.get(Number(n.round));
      const status = n.claimStatus || claim?.status || null;
      return {
        at: n.at ?? n.round * 1000,
        date: new Date(n.at ?? n.round * 1000).toISOString().slice(0, 7),
        day: new Date(n.round * 1000).toISOString().slice(0, 10),
        round: n.round,
        rank: n.rank,
        prizeUsdc: Number(n.prizeUsdc || claim?.prizeUsdc || 0),
        mint: n.mint,
        title: n.title || "ZKCTF Saturday race",
        host: n.host || { id: "zkctf", name: "ZKCTF", logo: "/logo.png" },
        medal: n.rank === 1 ? "gold" : n.rank === 2 ? "silver" : n.rank === 3 ? "bronze" : "paid",
        claimStatus: status,
        claimable: status === "claimable",
      };
    });
    // Live week appears above settled history so full clears show before NFT mint.
    if (liveWeek?.cleared && liveWeek.place) {
      const startMs = Date.parse(meta.start) || Date.now();
      activity.unshift({
        at: liveWeek.finishTime ?? Date.now(),
        date: new Date(startMs).toISOString().slice(0, 7),
        day: new Date(startMs).toISOString().slice(0, 10),
        round: Math.floor(startMs / 1000),
        rank: liveWeek.place,
        prizeUsdc: 0,
        title: "This week’s race (live)",
        host: { id: "zkctf", name: "ZKCTF", logo: "/logo.png" },
        medal: liveWeek.place === 1 ? "gold" : liveWeek.place === 2 ? "silver" : liveWeek.place === 3 ? "bronze" : "paid",
        live: true,
      });
    }
    res.json({
      profile,
      wallet,
      shortWallet: `${wallet.slice(0, 4)}…${wallet.slice(-4)}`,
      finishes: loyalty?.count ?? 0,
      tier: loyalty?.tier ?? null,
      founding: Boolean(founder?.founder),
      founderOrdinal: founder?.ordinal ?? null,
      academyMember: Boolean(member?.active),
      weekWins: wins.length,
      weekNfts: nfts.slice(0, 24),
      prestige: prestige
        ? { points: prestige.points, badge: prestige.badge, lifetime: prestige.lifetime }
        : null,
      liveWeek,
      firstPlaces,
      secondPlaces,
      thirdPlaces,
      top10: wins.length,
      medals: {
        payouts,
        first: firstPlaces,
        second: secondPlaces,
        third: thirdPlaces,
        earnedUsdc: Math.round(earnedUsdc * 1e6) / 1e6,
      },
      activity,
      prizeClaims,
      claimable: claimableFor(wallet),
      sharePath: `/u/${profile.pseudonym}`,
    });
  } catch (e) {
    res.status(502).json({ error: String(e.message ?? e) });
  }
});

app.get("/profile/:wallet", (req, res) => {
  const profile = profileFor(req.params.wallet);
  res.json({
    profile,
    displayName: displayName(req.params.wallet),
    weekNfts: weekNftsFor(req.params.wallet),
    prizeClaims: claimsFor(req.params.wallet),
    publicPath: profile?.pseudonym ? `/u/${profile.pseudonym}` : null,
  });
});

app.get("/prize/claims/:wallet", (req, res) => {
  res.json({
    claims: claimsFor(req.params.wallet),
    claimable: claimableFor(req.params.wallet),
  });
});

/** Claim a rescue/treasury prize for a past round (wallet signature required). */
app.post("/prize/claim", express.json(), async (req, res) => {
  const wallet = walletFromRequest(req);
  if (!wallet) {
    res.status(401).json({ error: "Sign in with your wallet to claim a prize." });
    return;
  }
  const roundKey = String(req.body?.round ?? "");
  if (!roundKey) {
    res.status(400).json({ error: "round required." });
    return;
  }
  const auth = await authorityStatus();
  if (!auth.ok) {
    res.status(503).json({ error: PAYMENTS_PAUSED });
    return;
  }
  try {
    const out = await executeClaim({ connection, authority, wallet, roundKey });
    if (!out.ok) {
      res.status(400).json(out);
      return;
    }
    res.json({
      ok: true,
      ...out,
      claims: claimsFor(wallet),
      claimable: claimableFor(wallet),
      note: "Prize sent from treasury USDC to your wallet ATA.",
    });
  } catch (e) {
    res.status(502).json({ error: String(e.message ?? e) });
  }
});

app.post("/profile", express.json(), async (req, res) => {
  const wallet = walletFromRequest(req);
  if (!wallet) {
    res.status(401).json({ error: "Sign in with your wallet to set a pseudonym." });
    return;
  }
  if (req.body?.wallet && String(req.body.wallet) !== wallet) {
    res.status(403).json({ error: "Wallet mismatch." });
    return;
  }
  const out = setProfile(wallet, req.body?.pseudonym ?? req.body?.name, {
    emoji: req.body?.emoji,
  });
  if (!out.ok) {
    res.status(400).json(out);
    return;
  }
  res.json(out);
});

/** Change emoji anytime; clearPhoto switches display back from an uploaded image. */
app.post("/profile/emoji", express.json(), (req, res) => {
  const wallet = walletFromRequest(req);
  if (!wallet) {
    res.status(401).json({ error: "Sign in with your wallet to change your emoji." });
    return;
  }
  const clearPhoto = Boolean(req.body?.clearPhoto);
  if (clearPhoto) {
    const cleared = removeProfileImage(wallet);
    if (!cleared.ok) {
      res.status(400).json(cleared);
      return;
    }
  }
  const out = setEmoji(wallet, req.body?.emoji, { clearPhoto: false });
  if (!out.ok) {
    res.status(400).json(out);
    return;
  }
  res.json(out);
});

/** Personal photo on the Railway volume (JPEG/PNG/WebP, max ~300 KB). Not an NFT. */
app.get("/avatars/:wallet", (req, res) => {
  const img = readProfileImage(req.params.wallet);
  if (!img) {
    res.status(404).end();
    return;
  }
  res.setHeader("Content-Type", img.mime);
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  res.setHeader("ETag", `"${img.at}"`);
  if (req.headers["if-none-match"] === `"${img.at}"`) {
    res.status(304).end();
    return;
  }
  res.send(img.buf);
});

app.post("/profile/avatar", express.json({ limit: "500kb" }), (req, res) => {
  const wallet = walletFromRequest(req);
  if (!wallet) {
    res.status(401).json({ error: "Sign in with your wallet to upload a photo." });
    return;
  }
  const out = saveProfileImage(wallet, req.body?.image ?? req.body?.dataUrl);
  if (!out.ok) {
    res.status(400).json(out);
    return;
  }
  res.json({ ...out, profile: profileFor(wallet), maxBytes: MAX_BYTES });
});

app.delete("/profile/avatar", (req, res) => {
  const wallet = walletFromRequest(req);
  if (!wallet) {
    res.status(401).json({ error: "Sign in with your wallet to remove a photo." });
    return;
  }
  const out = removeProfileImage(wallet);
  if (!out.ok) {
    res.status(400).json(out);
    return;
  }
  res.json({ ...out, profile: profileFor(wallet) });
});

app.get("/gift/academy/:wallet", async (req, res) => {
  try {
    res.json(await giftStatus(connection, req.params.wallet));
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

/** Free 1-month seat after N Finisher rounds — wallet signs mint_seat, no USDC. */
app.post("/gift/academy", express.json(), async (req, res) => {
  const wallet = walletFromRequest(req) ?? String(req.body?.wallet ?? "");
  if (!wallet) {
    res.status(401).json({ error: "Sign in with your wallet to claim the Academy gift." });
    return;
  }
  const auth = await authorityStatus();
  if (!auth.ok) {
    res.status(503).json({ error: PAYMENTS_PAUSED });
    return;
  }
  try {
    const { tx, months } = await buildGiftTx({ connection, authority, wallet });
    const sim = await connection.simulateTransaction(tx);
    if (sim.value.err) {
      res.status(400).json({
        error: `Gift simulation failed: ${(sim.value.logs ?? []).slice(-3).join(" · ") || JSON.stringify(sim.value.err)}`,
      });
      return;
    }
    tx.partialSign(authority);
    res.json({
      tx: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
      months,
      finishesNeeded: GIFT_FINISHES,
      note: `${months} month Academy seat — no USDC. Sign once; lifetime one claim per wallet.`,
    });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.post("/gift/academy/confirm", express.json(), async (req, res) => {
  const wallet = String(req.body?.wallet ?? "");
  const signature = req.body?.signature ? String(req.body.signature) : null;
  if (!wallet) {
    res.status(400).json({ error: "wallet required" });
    return;
  }
  try {
    const member = await memberStatus(connection, wallet);
    if (!member?.expiry) {
      res.status(409).json({ error: "Seat not on chain yet." });
      return;
    }
    const row = markGiftClaimed(wallet, signature);
    res.json({ ok: true, gift: row, member, months: GIFT_MONTHS });
  } catch (e) {
    res.status(502).json({ error: String(e.message ?? e) });
  }
});

app.get("/week-nft/art.svg", (_req, res) => {
  res.type("image/svg+xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0c10"/>
      <stop offset="100%" stop-color="#0d3d3a"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#g)"/>
  <circle cx="400" cy="360" r="140" fill="none" stroke="#2dd4bf" stroke-width="6"/>
  <path d="M280 360 L360 440 L520 280" fill="none" stroke="#f5f0e8" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="400" y="560" text-anchor="middle" fill="#f5f0e8" font-family="ui-monospace,monospace" font-size="36">ZKCTF</text>
  <text x="400" y="610" text-anchor="middle" fill="#2dd4bf" font-family="ui-monospace,monospace" font-size="22">WEEK WINNER</text>
  <text x="400" y="660" text-anchor="middle" fill="#f5f0e880" font-family="ui-monospace,monospace" font-size="14">SOULBOUND · NO CASH VALUE</text>
</svg>`);
});

app.get("/week-nft/meta/:round/:wallet.json", (req, res) => {
  const meta = weekMeta(req.params.round);
  const mine = (meta.winners ?? []).find((w) => w.wallet === req.params.wallet);
  res.json({
    ...meta,
    name: mine ? `ZKCTF Week #${mine.rank} · ${mine.pseudonym}` : meta.name,
    attributes: [
      ...(meta.attributes ?? []),
      ...(mine
        ? [
            { trait_type: "rank", value: mine.rank },
            { trait_type: "pseudonym", value: mine.pseudonym },
            { trait_type: "wallet", value: mine.wallet },
          ]
        : []),
    ],
  });
});

app.get("/week-nft/meta/:round", (req, res) => {
  res.json(weekMeta(req.params.round));
});

app.get("/week-nft/:wallet", (req, res) => {
  res.json({ nfts: weekNftsFor(req.params.wallet) });
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
        member: Boolean(offer.status?.founding) && !offer.excluded,
        ordinal: offer.excluded
          ? null
          : (wallet && founderFor(wallet)?.ordinal) || offer.carried?.ordinal || null,
        carried: Boolean(offer.carried) && !offer.excluded,
        carriedDiscount: offer.carriedDiscount && !offer.excluded,
        excluded: Boolean(offer.excluded),
      },
      member: offer.status
        ? { ...offer.status, founding: offer.excluded ? false : offer.status.founding }
        : null,
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
  const wallet = req.params.wallet;
  if (isExcludedFounder(wallet)) {
    res.json({ founder: false, ordinal: null, carried: false, excluded: true });
    return;
  }
  const row = founderFor(wallet);
  const carried = snapshotFounder(wallet);
  res.json({
    founder: Boolean(row || carried),
    ordinal: row?.ordinal ?? carried?.ordinal ?? null,
    carried: Boolean(carried),
    excluded: false,
  });
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

app.get("/entry/:wallet", async (req, res) => {
  const meta = windowMeta();
  const row = getEntry(req.params.wallet, meta.start);
  let onChain = null;
  try {
    onChain = await entryForRound(connection, req.params.wallet);
  } catch {
    /* RPC blip — fall back to host index */
  }
  // Live race unlock = paid on-chain Entry for this round (5 USDC). Host row alone is not enough.
  const entered = Boolean(onChain) || (Boolean(row) && process.env.ALLOW_HOST_ENTRY === "1");
  res.json({
    entered,
    paidOnChain: Boolean(onChain),
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
          chainNote = `Host entry saved; on-chain enter not ready — ${explainEnterSimFailure(sim)}`;
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

  let paidOnChain = false;
  try {
    paidOnChain = Boolean(await entryForRound(connection, wallet));
  } catch {
    /* ignore */
  }
  res.json({
    ok: true,
    demo: !txB64 && !paidOnChain,
    // Play unlocks only after the 5 USDC enter_round tx (or an existing on-chain Entry).
    entered: paidOnChain,
    paidOnChain,
    ...row,
    nWinners: N_WINNERS,
    tx: txB64,
    usdcMint: USDC_MINT.toBase58(),
    potAta: potAta().toBase58(),
    note:
      chainNote ??
      (paidOnChain
        ? "Already entered on-chain for this round."
        : "Sign the 5 USDC enter transaction — Play unlocks only after it confirms."),
  });
});

app.post("/prove-assist", express.json(), async (req, res) => {
  const wallet = String(req.body?.wallet ?? "");
  const levelId = Number(req.body?.level);
  const flag = String(req.body?.c ?? req.body?.flag ?? "");
  const nonceHex = String(req.body?.n ?? req.body?.nonce ?? "");
  const meta = windowMeta();
  // Hard gate: on-chain Entry for this round exists only after enter_round moved 5 USDC into the pot.
  let paid = null;
  try {
    paid = await entryForRound(connection, wallet);
  } catch (e) {
    res.status(502).json({ error: `Could not verify entry on-chain: ${String(e.message ?? e)}` });
    return;
  }
  if (!paid && process.env.ALLOW_HOST_ENTRY !== "1") {
    res.status(403).json({
      error: "Pay the 5 USDC entry on-chain before submitting. Host-only enter does not unlock the live race.",
    });
    return;
  }
  if (!paid && !getEntry(wallet, meta.start)) {
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
  // Host puzzles must match on-chain commitments, or Groth16 verify fails with Custom(14).
  let commitmentMismatch = false;
  try {
    const chain = await onChainRound(connection);
    const hostH = String(level.h ?? "").replace(/^0x/, "").toLowerCase();
    const chainH = String(chain?.commitments?.[levelId] ?? "").toLowerCase();
    commitmentMismatch = Boolean(chain && hostH && chainH && hostH !== chainH);
  } catch (e) {
    console.error("commitment check failed", e);
  }

  // Rescue: lost round.json — credit host progress so Play works; on-chain pot uses Entry bits (may lag).
  const hostRescue = commitmentMismatch || process.env.RESCUE_HOST_SOLVE === "1";
  if (hostRescue && commitmentMismatch) {
    recordSolve(wallet, levelId, meta.start);
    const prestige = awardSolve(wallet, levelId, meta.start);
    const progress = solveProgress(wallet, meta.start, publicLevels().length);
    res.json({
      ok: true,
      hostOnly: true,
      level: levelId,
      h: level.h,
      prestige,
      progress,
      boardNote:
        "Host rescue: on-chain commitments do not match this server’s puzzles (missing round.json). Progress is saved on the host; pot settlement still follows on-chain Entry bits.",
    });
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
  try {
    const row = await entryForRound(connection, wallet);
    if (!row) {
      res.status(403).json({
        error: "Pay the 5 USDC entry on-chain before submitting.",
      });
      return;
    }
    if (levelId < 0 || levelId > 7 || !(row.solvedMask & (1 << levelId))) {
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
  const nProfiles = Object.keys(load(dataPath("profiles.json")).byWallet ?? {}).length;
  console.log(`dataDir=${DATA_DIR} persistent=${dataPersistent} profiles=${nProfiles}`);
  if (!dataPersistent) {
    console.error("WARNING: dataDir is ephemeral — redeploys wipe profiles/entries. Set ZKCTF_DATA_DIR=/data and mount a volume.");
  }
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

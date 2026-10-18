/**
 * Weekly automation, run inside the API process (BOT_SCHEDULER=0 disables it).
 *
 * Every tick (default 5 min) re-reads chain state and does whatever is due, in this order:
 *   1. settle the on-chain round once it has ended (must happen before a new round overwrites it)
 *   2. mint the Finisher loyalty token to every wallet that cleared all levels of that round
 *   3. mint soulbound week-winner NFTs to the top-N payees
 *   4. generate next week's levels if the host round is not for the upcoming window
 *   5. publish next week's commitments on chain (create_round)
 *   6. sync the Founding members registry (hourly)
 * Each step is idempotent: it checks chain state first, so restarts, overlapping deploys or a
 * manual script run cannot double-settle, double-mint or overwrite a live round.
 */
import { Transaction } from "@solana/web3.js";
import {
  ata,
  createAtaIdempotentIx,
  createRoundIx,
  finishersOnChain,
  onChainRound,
  sendAndConfirm,
  settleIx,
} from "./chain.js";
import { generateRound } from "./bot.js";
import { syncFounders } from "./founders.js";
import { awardRound, loyaltyMint, reconcileLoyaltyRound, hostFinishersForRound } from "./loyalty.js";
import { treasuryOwner } from "./membership.js";
import { N_WINNERS, saturdayWindow } from "./race.js";
import { readRound, roundCommitments, writeRound } from "./roundStore.js";
import { dataPersistent } from "./dataDir.js";
import { dataPath, load, save } from "./store.js";
import { rankSolvers, rankSolversUnix, inferLevelCount } from "./solves.js";
import { awardWeekWinners, recordHostPlacements } from "./weekNft.js";
import {
  recordSettlePaid,
  openRescueClaims,
  hostWinnersFromNfts,
  reconcileTreasuryRound,
  releaseStaleClaims,
} from "./prizeClaims.js";
import { ENTRY_ATOMS } from "./payout.js";

const PATH = dataPath("scheduler.json");
const TICK_MS = Number(process.env.BOT_TICK_MS ?? 5 * 60_000);
const SETTLE_GRACE_S = 120;
const MIN_SOL = Number(process.env.BOT_MIN_SOL ?? 0.05);

const state = () => ({ rounds: {}, history: [], ...load(PATH) });

function remember(s, event, extra = {}) {
  s.history = [{ at: new Date().toISOString(), event, ...extra }, ...(s.history ?? [])].slice(0, 50);
  save(PATH, s);
}

const alerted = new Map();
async function notify(msg, key = msg) {
  console.log(`[bot] ${msg}`);
  const url = process.env.BOT_ALERT_WEBHOOK;
  if (!url) return;
  if (Date.now() - (alerted.get(key) ?? 0) < 6 * 3600_000) return;
  alerted.set(key, Date.now());
  try {
    const target = new URL(url);
    const text = `ZKCTF bot: ${msg}`;
    // Discord reads `content`, Slack reads `text`; Telegram sendMessage also needs chat_id in the body.
    const body = { content: text, text };
    if (target.hostname === "api.telegram.org") {
      body.chat_id = target.searchParams.get("chat_id");
      target.search = "";
    }
    await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    /* alerts are best effort */
  }
}

export async function settleOnChain({ connection, authority, round }) {
  const winners = (await finishersOnChain(connection, round)).slice(0, N_WINNERS);
  const { splitPot } = await import("./payout.js");
  const potAtoms = Number(round.potAtoms ?? 0);
  const { pays } = splitPot(potAtoms, winners.length);
  const paysUsdc = pays.map((a) => a / 1e6);
  const treasuryAta = ata(treasuryOwner(authority));
  const needed = [{ owner: treasuryOwner(authority), key: treasuryAta }, ...winners.map((w) => ({ owner: w.wallet, key: ata(w.wallet) }))];
  const infos = await connection.getMultipleAccountsInfo(needed.map((n) => n.key));
  const missing = needed.filter((_, i) => !infos[i]);
  for (let i = 0; i < missing.length; i += 5) {
    const tx = new Transaction();
    for (const m of missing.slice(i, i + 5)) tx.add(createAtaIdempotentIx({ payer: authority.publicKey, owner: m.owner }));
    await sendAndConfirm(connection, tx, [authority]);
  }
  const tx = new Transaction().add(
    settleIx({
      authority: authority.publicKey.toBase58(),
      treasuryAta: treasuryAta.toBase58(),
      winnerAtas: winners.map((w) => ata(w.wallet).toBase58()),
      k: winners.length,
    }),
  );
  const sig = await sendAndConfirm(connection, tx, [authority]);
  return {
    sig,
    winners: winners.map((w) => w.wallet),
    paysUsdc: paysUsdc.slice(0, winners.length),
    potAtoms,
  };
}

export async function createRoundOnChain({ connection, authority, row }) {
  const tx = new Transaction().add(
    createRoundIx({
      payer: authority.publicKey.toBase58(),
      authority: authority.publicKey.toBase58(),
      start: Math.floor(Date.parse(row.start) / 1000),
      end: Math.floor(Date.parse(row.end) / 1000),
      levelCount: row.levels.length,
      commitments: roundCommitments(),
    }),
  );
  return sendAndConfirm(connection, tx, [authority]);
}

/** `onChainStart`: if the chain already committed to this window, regenerating would orphan those commitments. */
export async function prepareNextRound({ log = console.log, onChainStart = null } = {}) {
  const { start, end } = saturdayWindow();
  const stored = readRound();
  if (stored.start === start.toISOString()) return null;
  if (onChainStart === Math.floor(start.getTime() / 1000)) {
    // Do not invent a new round.json that cannot match lost on-chain commitments.
    // Ops: restore /data/round.json or run scripts/rescue-round.mjs (same-window commitment refresh).
    throw new Error(
      `chain already has a round for ${start.toISOString()} but round.json does not; restore round.json from backup or run: node scripts/rescue-round.mjs`,
    );
  }
  const { levels, source } = await generateRound({ avoid: (stored.levels ?? []).map((l) => l.type).filter(Boolean), log });
  return writeRound({ start: start.toISOString(), end: end.toISOString(), levels, source });
}

export function startScheduler({ connection, authority, authorityStatus }) {
  if (process.env.BOT_SCHEDULER === "0") {
    console.log("[bot] scheduler disabled (BOT_SCHEDULER=0)");
    return { status: () => ({ enabled: false }) };
  }
  // Opt-in so a dev machine holding the authority key never publishes rounds next to production.
  const chainWrites = process.env.BOT_CHAIN === "1";
  let busy = false;
  let lastFounderSync = 0;
  let last = { at: null, error: null, sol: null, authorityOk: null };

  async function tick() {
    if (busy) return;
    busy = true;
    const s = state();
    try {
      const auth = await authorityStatus();
      const sol = (await connection.getBalance(authority.publicKey)) / 1e9;
      last = { ...last, sol, authorityOk: auth.ok };
      if (chainWrites && !dataPersistent) {
        await notify(
          "CRITICAL: dataDir is not on a volume — chain bot paused so redeploys cannot wipe profile reputation.",
          "ephemeral",
        );
      }
      const canWrite = chainWrites && auth.ok && dataPersistent;
      if (!chainWrites) await notify("BOT_CHAIN is not 1: levels are generated, but settle / loyalty / create_round are skipped.", "nochain");
      if (chainWrites && !auth.ok) await notify(`authority mismatch: server ${auth.server}, chain ${auth.onChain}. Chain steps paused.`, "auth");
      if (canWrite && sol < MIN_SOL) await notify(`authority ${auth.server} has ${sol.toFixed(4)} SOL, below ${MIN_SOL}. Top it up.`, "sol");

      const now = Math.floor(Date.now() / 1000);
      let round = await onChainRound(connection);

      // Host board → volume as soon as the Saturday window ends (mint optional).
      // Re-run while empty so late-written solves still land before/after settle.
      {
        const host = readRound();
        const hostEndMs = Date.parse(host.end);
        const hostStartS = Math.floor(Date.parse(host.start) / 1000);
        const prevBoard = s.rounds[hostStartS]?.hostBoard;
        if (
          Number.isFinite(hostEndMs) &&
          Number.isFinite(hostStartS) &&
          Date.now() > hostEndMs &&
          (!prevBoard || prevBoard.total === 0)
        ) {
          const nLevels = host.levels?.length || inferLevelCount(host.start) || 0;
          const ranked = rankSolvers(host.start, nLevels)
            .slice(0, N_WINNERS)
            .map((r) => r.wallet);
          const snap = recordHostPlacements(hostStartS, ranked, { source: "host" });
          s.rounds[hostStartS] = { ...s.rounds[hostStartS], hostBoard: snap };
          remember(s, "hostBoard", { round: hostStartS, added: snap.added, total: snap.total });
          if (snap.added) await notify(`host board saved for ${host.start}: ${snap.total} placement(s) on volume`);
        }
      }

      if (canWrite && round && !round.settled && now > round.end + SETTLE_GRACE_S) {
        // Snapshot host finishers BEFORE settle (Entry PDA may rotate on next create_round).
        const hostIso = new Date(round.start * 1000).toISOString();
        const nLevels = round.levelCount || inferLevelCount(hostIso) || 0;
        const hostFinishers = rankSolversUnix(round.start, nLevels)
          .slice(0, N_WINNERS)
          .map((r) => r.wallet);

        const out = await settleOnChain({ connection, authority, round });
        s.rounds[round.start] = { ...s.rounds[round.start], settled: out };
        remember(s, "settled", {
          round: round.start,
          sig: out.sig,
          winners: out.winners.length,
          potAtoms: out.potAtoms,
        });
        await notify(`settled round ${new Date(round.start * 1000).toISOString()}: ${out.winners.length} winner(s), tx ${out.sig}`);

        if (out.winners?.length) {
          recordHostPlacements(round.start, out.winners, {
            source: "settle",
            paysUsdc: out.paysUsdc,
          });
          recordSettlePaid(round.start, out.winners, out.paysUsdc, out.sig);
        } else {
          // Pot → treasury (k=0). Open claimable prizes for every host full-clear.
          const ranked = hostFinishers.length ? hostFinishers : hostWinnersFromNfts(round.start);
          const potAtoms = out.potAtoms || ranked.length * ENTRY_ATOMS;
          recordHostPlacements(round.start, ranked, { source: "host" });
          const rescue = openRescueClaims(round.start, {
            potAtoms,
            hostWinners: ranked,
            settleSig: out.sig,
          });
          s.rounds[round.start] = {
            ...s.rounds[round.start],
            prizeClaims: rescue,
            hostBoard: { total: ranked.length, added: ranked.length },
          };
          save(PATH, s);
          if (rescue.opened) {
            remember(s, "prizeClaims", { round: round.start, opened: rescue.opened, potAtoms });
            await notify(
              `settle paid 0 on-chain; opened ${rescue.opened} treasury claim(s) for host finishers (round ${round.start})`,
            );
          } else if (ranked.length) {
            await notify(
              `settle k=0 but opened 0 claims (round ${round.start}, finishers=${ranked.length}, pot=${potAtoms})`,
              `claims0:${round.start}`,
            );
          }
        }
        round = await onChainRound(connection);
      }

      // Backfill treasury claims for past k=0 settles that missed host finishers (e.g. ISO mismatch).
      releaseStaleClaims();
      for (const h of s.history ?? []) {
        if (h.event !== "settled" || (h.winners ?? 0) > 0 || !h.round) continue;
        const rk = String(h.round);
        s.rounds[rk] ??= {};
        if (!s.rounds[rk].settled) {
          s.rounds[rk].settled = {
            sig: h.sig,
            winners: [],
            potAtoms: h.potAtoms ?? 0,
            paysUsdc: [],
          };
        } else if (!s.rounds[rk].settled.potAtoms && h.potAtoms) {
          s.rounds[rk].settled.potAtoms = h.potAtoms;
        }
      }
      for (const [rk, meta] of Object.entries(s.rounds ?? {})) {
        const settled = meta?.settled;
        if (!settled) continue;
        const paidN = Array.isArray(settled.winners) ? settled.winners.length : Number(settled.winners) || 0;
        if (paidN > 0) continue;
        // Retry until we have host finishers on the ledger (solves may land after settle).
        if (meta?.prizeClaims?.reconciled && (meta.prizeClaims.finishers ?? 0) > 0) continue;
        const potAtoms = Number(settled.potAtoms) || 0;
        const out = reconcileTreasuryRound(rk, {
          potAtoms: potAtoms || undefined,
          settleSig: settled.sig,
          levelCount: settled.levelCount,
        });
        if (out.ok) {
          s.rounds[rk] = {
            ...s.rounds[rk],
            prizeClaims: { ...out, reconciled: true },
            hostBoard: { total: out.wallets?.length ?? 0, added: out.placements?.added ?? 0 },
          };
          save(PATH, s);
          if (out.opened || out.updated) {
            remember(s, "prizeClaims", {
              round: Number(rk),
              opened: out.opened,
              updated: out.updated,
              reconciled: true,
              potAtoms: out.potAtoms,
            });
            await notify(
              `reconciled treasury claims for round ${rk}: +${out.opened} open, ${out.updated} updated, ${out.finishers} finishers`,
            );
          }
        }
      }

      // Finisher mints: on-chain full clears ∪ host full clears (retry if earlier pass found 0).
      if (canWrite && round?.settled && loyaltyMint()) {
        const prev = s.rounds[round.start]?.loyalty;
        const needsLoyalty = !prev || ((prev.finishers ?? 0) === 0 && !(prev.minted > 0));
        if (needsLoyalty) {
          const onChain = (await finishersOnChain(connection, round)).map((f) => f.wallet);
          const host = hostFinishersForRound(round.start, round.levelCount);
          const finishers = [...new Set([...onChain, ...host])];
          const out = await awardRound(connection, authority, String(round.start), finishers);
          s.rounds[round.start] = {
            ...s.rounds[round.start],
            loyalty: { ...out, finishers: finishers.length, onChain: onChain.length, host: host.length },
          };
          save(PATH, s);
          remember(s, "loyalty", {
            round: round.start,
            finishers: finishers.length,
            minted: out.minted ?? 0,
          });
          if (out.minted) await notify(`Finisher mints for round ${round.start}: ${out.minted} wallet(s)`);
        }
      }

      // Backfill Finisher mints for past settled rounds that minted nobody (e.g. k=0 on-chain).
      if (canWrite && loyaltyMint()) {
        for (const h of s.history ?? []) {
          if (h.event !== "settled" || !h.round) continue;
          const rk = String(h.round);
          s.rounds[rk] ??= {};
          s.rounds[rk].settled ??= { sig: h.sig, winners: [], potAtoms: h.potAtoms ?? 0 };
        }
        for (const [rk, meta] of Object.entries(s.rounds ?? {})) {
          if (!meta?.settled) continue;
          const loy = meta.loyalty;
          if (loy?.reconciled) continue;
          try {
            const onChainWallets = Array.isArray(meta.settled.winners) ? meta.settled.winners : [];
            const out = await reconcileLoyaltyRound(connection, authority, rk, {
              onChainWallets,
              levelCount: meta.settled.levelCount,
            });
            const done = (out.finishers ?? 0) > 0 || (out.minted ?? 0) > 0;
            s.rounds[rk] = { ...s.rounds[rk], loyalty: { ...out, reconciled: done } };
            save(PATH, s);
            if (out.minted > 0) {
              remember(s, "loyalty", { round: Number(rk), finishers: out.finishers, minted: out.minted, reconciled: true });
              await notify(`reconciled Finisher mints for round ${rk}: ${out.minted} wallet(s)`);
            }
          } catch (e) {
            await notify(`loyalty reconcile failed for ${rk}: ${e.message ?? e}`, `loy:${rk}`);
          }
        }
      }

      if (canWrite && round?.settled && !s.rounds[round.start]?.weekNft) {
        const winners =
          s.rounds[round.start]?.settled?.winners ??
          (await finishersOnChain(connection, round)).slice(0, N_WINNERS).map((f) => f.wallet);
        if (winners.length) {
          const settled = s.rounds[round.start]?.settled;
          recordHostPlacements(round.start, winners, {
            source: "settle",
            paysUsdc: settled?.paysUsdc,
          });
          const out = await awardWeekWinners(connection, authority, round.start, winners, {
            paysUsdc: settled?.paysUsdc,
          });
          s.rounds[round.start] = { ...s.rounds[round.start], weekNft: out };
          remember(s, "weekNft", { round: round.start, minted: out.minted });
          await notify(`week NFTs for round ${round.start}: minted ${out.minted}`);
        } else {
          s.rounds[round.start] = { ...s.rounds[round.start], weekNft: { minted: 0, total: 0 } };
        }
      }

      const fresh = await prepareNextRound({ log: (m) => console.log(`[bot]${m}`), onChainStart: round?.start ?? null });
      if (fresh) remember(s, "generated", { start: fresh.start, source: fresh.source, types: fresh.levels.map((l) => l.type) });

      const row = readRound();
      const startS = Math.floor(Date.parse(row.start) / 1000);
      const endS = Math.floor(Date.parse(row.end) / 1000);
      if (canWrite && row.start && now < endS && round?.start !== startS && (!round || round.settled)) {
        const sig = await createRoundOnChain({ connection, authority, row });
        s.rounds[startS] = { ...s.rounds[startS], created: sig };
        remember(s, "create_round", { start: row.start, sig });
        await notify(`published round ${row.start} on chain, tx ${sig}`);
      } else if (round?.start === startS) {
        const host = roundCommitments().map((b) => b.toString("hex"));
        if (host.some((h, i) => h !== round.commitments[i]))
          await notify(`on-chain commitments for ${row.start} differ from this server's round.json: valid flags will fail on chain. Was the round published from another machine?`, "commit");
      }

      if (Date.now() - lastFounderSync > 3600_000) {
        const out = await syncFounders(connection);
        lastFounderSync = Date.now();
        if (out.added) remember(s, "founders", out);
      }
      last = { ...last, at: new Date().toISOString(), error: null };
    } catch (e) {
      last = { ...last, at: new Date().toISOString(), error: String(e.message ?? e) };
      remember(s, "error", { error: last.error });
      await notify(`tick failed: ${last.error}`, `err:${last.error.slice(0, 80)}`);
    } finally {
      busy = false;
    }
  }

  setTimeout(tick, 10_000);
  setInterval(tick, TICK_MS).unref();
  return {
    tick,
    status: () => ({
      enabled: true,
      chainWrites,
      tickMs: TICK_MS,
      lastTick: last.at,
      lastError: last.error,
      authorityOk: last.authorityOk,
      authoritySol: last.sol,
      minSol: MIN_SOL,
      loyaltyMint: loyaltyMint()?.toBase58() ?? null,
      history: state().history.slice(0, 20),
    }),
  };
}

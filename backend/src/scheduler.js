/**
 * Weekly automation, run inside the API process (BOT_SCHEDULER=0 disables it).
 *
 * Every tick (default 5 min) re-reads chain state and does whatever is due, in this order:
 *   1. settle the on-chain round once it has ended (must happen before a new round overwrites it)
 *   2. mint the Finisher loyalty token to every wallet that cleared all levels of that round
 *   3. generate next week's levels if the host round is not for the upcoming window
 *   4. publish next week's commitments on chain (create_round)
 *   5. sync the Founding members registry (hourly)
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
import { awardRound, loyaltyMint } from "./loyalty.js";
import { treasuryOwner } from "./membership.js";
import { N_WINNERS, saturdayWindow } from "./race.js";
import { readRound, roundCommitments, writeRound } from "./roundStore.js";
import { dataPath, load, save } from "./store.js";

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
  return { sig, winners: winners.map((w) => w.wallet) };
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
    throw new Error(`chain already has a round for ${start.toISOString()} but round.json does not; restore round.json from backup.`);
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
      const canWrite = chainWrites && auth.ok;
      if (!chainWrites) await notify("BOT_CHAIN is not 1: levels are generated, but settle / loyalty / create_round are skipped.", "nochain");
      if (chainWrites && !auth.ok) await notify(`authority mismatch: server ${auth.server}, chain ${auth.onChain}. Chain steps paused.`, "auth");
      if (canWrite && sol < MIN_SOL) await notify(`authority ${auth.server} has ${sol.toFixed(4)} SOL, below ${MIN_SOL}. Top it up.`, "sol");

      const now = Math.floor(Date.now() / 1000);
      let round = await onChainRound(connection);

      if (canWrite && round && !round.settled && now > round.end + SETTLE_GRACE_S) {
        const out = await settleOnChain({ connection, authority, round });
        s.rounds[round.start] = { ...s.rounds[round.start], settled: out };
        remember(s, "settled", { round: round.start, sig: out.sig, winners: out.winners.length });
        await notify(`settled round ${new Date(round.start * 1000).toISOString()}: ${out.winners.length} winner(s), tx ${out.sig}`);
        round = await onChainRound(connection);
      }

      if (canWrite && round?.settled && loyaltyMint() && !s.rounds[round.start]?.loyalty) {
        const finishers = (await finishersOnChain(connection, round)).map((f) => f.wallet);
        const out = await awardRound(connection, authority, String(round.start), finishers);
        s.rounds[round.start] = { ...s.rounds[round.start], loyalty: { ...out, finishers: finishers.length } };
        remember(s, "loyalty", { round: round.start, finishers: finishers.length });
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

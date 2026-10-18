"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getJson, postJson } from "@/lib/api";
import { useLang } from "@/lib/lang";
import { walletAuth } from "@/lib/walletAuth";
import { hexToBytes, submitInstruction, sendB64Tx } from "@/lib/program";
import { Countdown } from "@/components/Countdown";
import { Leaderboard } from "@/components/Leaderboard";
import { ComputeBudgetProgram, Transaction } from "@solana/web3.js";

type Level = {
  id: number;
  title: string;
  statement: string;
  artifacts: string[];
  hints: string[];
  h: string;
  background?: { title: string; refs: { label: string; url: string }[] } | null;
};
type Progress = { solved: number[]; next: number | null; cleared: boolean; levelCount: number };

function HintBlock({ hints, label }: { hints: string[]; label: string }) {
  const [n, setN] = useState(0);
  return (
    <div className="mt-4">
      <button type="button" className="text-xs text-cream/50 underline" onClick={() => setN((x) => x + 1)}>
        {label}
      </button>
      {hints.slice(0, n).map((h) => (
        <p key={h} className="mt-2 text-xs text-cream/50">
          {h}
        </p>
      ))}
    </div>
  );
}

export default function PlayPage() {
  const { t } = useLang();
  const { publicKey, connected, sendTransaction, signMessage } = useWallet();
  const { connection } = useConnection();
  const [entered, setEntered] = useState(false);
  const [pseudonym, setPseudonym] = useState<string | null>(null);
  const [pseudoDraft, setPseudoDraft] = useState("");
  const [levels, setLevels] = useState<Level[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [roundLocked, setRoundLocked] = useState(false);
  const [openId, setOpenId] = useState<number | null>(0);
  const [flags, setFlags] = useState<Record<number, string>>({});
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(() => [...levels].sort((a, b) => a.id - b.id), [levels]);
  const solvedSet = useMemo(() => new Set(progress?.solved ?? []), [progress]);
  const nextId = progress?.next ?? (sorted[0]?.id ?? 0);

  function isUnlocked(id: number) {
    if (solvedSet.has(id)) return true;
    return id === nextId;
  }

  function refreshProgress(w: string) {
    return getJson<Progress>(`/progress/${w}`)
      .then((p) => {
        setProgress(p);
        if (p.next != null) setOpenId(p.next);
        else if (p.cleared && sorted.length) setOpenId(sorted[sorted.length - 1].id);
      })
      .catch(() => setProgress(null));
  }

  useEffect(() => {
    void getJson<{ levels: Level[]; locked?: boolean }>("/round")
      .then((r) => {
        setLevels(r.levels ?? []);
        setRoundLocked(Boolean(r.locked));
        setLoadErr(false);
        if (r.levels?.[0]) setOpenId(r.levels[0].id);
      })
      .catch(() => {
        setLevels([]);
        setLoadErr(true);
      });
  }, []);

  useEffect(() => {
    if (!publicKey) {
      setEntered(false);
      setProgress(null);
      setPseudonym(null);
      return;
    }
    const w = publicKey.toBase58();
    void getJson<{ profile: { pseudonym: string } | null }>(`/profile/${w}`)
      .then((r) => {
        setPseudonym(r.profile?.pseudonym ?? null);
        setPseudoDraft(r.profile?.pseudonym ?? "");
      })
      .catch(() => setPseudonym(null));
    void getJson<{ entered?: boolean }>(`/entry/${w}`)
      .then((r) => {
        setEntered(Boolean(r.entered));
        if (r.entered) void refreshProgress(w);
      })
      .catch(() => setEntered(false));
  }, [publicKey]);

  const open = entered;
  const ctfLabel = (id: number) => `CTF #${Number(id) + 1}`;

  async function savePseudonym() {
    if (!publicKey || !signMessage) return;
    setBusy(true);
    setNote(null);
    try {
      const headers = await walletAuth(publicKey.toBase58(), signMessage);
      const out = await postJson<{ ok: boolean; profile?: { pseudonym: string }; error?: string }>(
        "/profile",
        { wallet: publicKey.toBase58(), pseudonym: pseudoDraft },
        headers,
      );
      if (!out.ok || !out.profile) throw new Error(out.error ?? "Failed");
      setPseudonym(out.profile.pseudonym);
      setNote(t.profileSaved);
    } catch (e) {
      setNote(e instanceof Error ? e.message : t.rejected);
    } finally {
      setBusy(false);
    }
  }

  async function enterRace() {
    if (!publicKey || !sendTransaction) return;
    if (!pseudonym) {
      setNote(t.profileNeed);
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const out = await postJson<{ entered?: boolean; paidOnChain?: boolean; note?: string; tx?: string }>(
        "/enter",
        { wallet: publicKey.toBase58() },
      );
      if (out.tx) {
        try {
          await sendB64Tx(connection, sendTransaction, out.tx);
          setEntered(true);
          setNote(out.note ?? t.entered);
        } catch (e) {
          setEntered(false);
          setNote(
            e instanceof Error
              ? `5 USDC entry failed — Play stays locked until the pot payment confirms. (${e.message})`
              : "5 USDC entry failed — Play stays locked until the pot payment confirms.",
          );
          return;
        }
      } else if (out.paidOnChain || out.entered) {
        setEntered(true);
        setNote(out.note ?? t.entered);
      } else {
        setEntered(false);
        setNote(out.note ?? "On-chain 5 USDC entry is required before Play unlocks.");
        return;
      }
      await refreshProgress(publicKey.toBase58());
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Rejected.");
    } finally {
      setBusy(false);
    }
  }

  async function submitLevel(level: Level) {
    if (!publicKey || !sendTransaction) return;
    if (!isUnlocked(level.id)) {
      setNote(t.ctfLocked);
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const assist = await postJson<{
        ok: boolean;
        C: string;
        proof?: { a: string; b: string; c: string };
        progress?: Progress;
        error?: string;
        proveError?: string;
        hostOnly?: boolean;
        boardNote?: string;
      }>("/prove-assist", {
        wallet: publicKey.toBase58(),
        level: level.id,
        c: (flags[level.id] ?? "").trim(),
        prove: true,
      });
      if (!assist.ok) throw new Error(assist.error ?? "Rejected.");
      if (assist.proveError) throw new Error(assist.proveError);
      if (assist.hostOnly) {
        if (assist.progress) {
          setProgress(assist.progress);
          if (assist.progress.next != null) setOpenId(assist.progress.next);
        } else await refreshProgress(publicKey.toBase58());
        setNote(assist.boardNote ?? t.saved);
        return;
      }
      if (!assist.proof) {
        setNote(t.flagOkPending);
        return;
      }
      const ix = submitInstruction({
        player: publicKey,
        level: level.id,
        commit: hexToBytes(assist.C),
        proofA: hexToBytes(assist.proof.a),
        proofB: hexToBytes(assist.proof.b),
        proofC: hexToBytes(assist.proof.c),
      });
      const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      const confirmed = await postJson<{
        ok: boolean;
        progress?: Progress;
        error?: string;
      }>("/confirm-solve", {
        wallet: publicKey.toBase58(),
        level: level.id,
      });
      if (!confirmed.ok) throw new Error(confirmed.error ?? t.flagOkPending);
      if (confirmed.progress) {
        setProgress(confirmed.progress);
        if (confirmed.progress.next != null) setOpenId(confirmed.progress.next);
      } else {
        await refreshProgress(publicKey.toBase58());
      }
      setNote(confirmed.progress?.cleared ? t.ctfCleared : t.saved);
    } catch (e) {
      setNote(e instanceof Error && e.message && e.message !== "Rejected." ? e.message : t.rejected);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold sm:text-3xl">{t.play}</h1>
      <p className="mt-2 max-w-xl text-sm text-cream/60">{t.ctfLinearLead}</p>
      <div className="mt-4 max-w-md">
        <Countdown />
      </div>
      {loadErr && <p className="mt-3 text-sm text-teal">{t.roundLoadError}</p>}
      {!open && <p className="mt-3 text-sm text-cream/60">{t.locked}</p>}
      {!connected && <p className="mt-6 text-sm text-teal">{t.connectFirst}</p>}
      {connected && !open && !pseudonym && (
        <div className="mt-6 max-w-md rounded-3xl border border-cream/15 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-teal">{t.profileTitle}</p>
          <p className="mt-2 text-sm text-cream/60">{t.profileNeed}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={pseudoDraft}
              onChange={(e) => setPseudoDraft(e.target.value)}
              placeholder="0xWarden"
              maxLength={20}
              className="min-h-12 flex-1 rounded-2xl border border-cream/15 bg-ink px-4 font-mono text-sm"
            />
            <button
              type="button"
              disabled={busy || pseudoDraft.trim().length < 3}
              onClick={() => void savePseudonym()}
              className="min-h-12 rounded-2xl bg-teal/20 px-5 text-sm text-teal disabled:opacity-40"
            >
              {t.profileCreate}
            </button>
          </div>
        </div>
      )}
      {connected && !open && pseudonym && (
        <p className="mt-4 font-mono text-xs text-cream/50">
          {t.profileAs} <span className="text-teal">{pseudonym}</span>
        </p>
      )}
      {connected && !open && (
        <button
          type="button"
          disabled={busy || !pseudonym}
          onClick={() => void enterRace()}
          className="mt-6 inline-flex min-h-12 items-center rounded-full bg-cream px-5 text-sm font-medium text-ink disabled:opacity-40"
        >
          {t.enterBtn}
        </button>
      )}
      {open && progress?.cleared && (
        <p className="mt-4 text-sm text-teal">{t.ctfCleared}</p>
      )}

      <p className="mt-6 rounded-2xl border border-cream/15 px-4 py-3 text-sm text-cream/55">
        {t.devnetLive}
      </p>

      <div className="mt-8 space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-teal">{t.officialSet}</p>
        {sorted.length === 0 && !loadErr && (
          <p className="text-sm text-cream/50">{roundLocked ? t.roundLocked : t.noLevels}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {sorted.map((lv) => {
            const unlocked = open && isUnlocked(lv.id);
            const done = solvedSet.has(lv.id);
            return (
              <button
                key={lv.id}
                type="button"
                disabled={!unlocked}
                onClick={() => unlocked && setOpenId(lv.id)}
                className={`rounded-3xl border p-4 text-left disabled:cursor-not-allowed disabled:opacity-40 ${
                  openId === lv.id && unlocked ? "border-teal bg-teal/10" : "border-cream/15"
                }`}
              >
                <span className="font-mono text-xs text-cream/45">
                  {ctfLabel(lv.id)}
                  {done ? " · ✓" : unlocked ? "" : " · 🔒"}
                </span>
                <span className="mt-1 block text-sm font-medium">
                  {unlocked ? lv.title : t.ctfLockedTitle}
                </span>
              </button>
            );
          })}
        </div>
        {sorted
          .filter((lv) => lv.id === openId && open && isUnlocked(lv.id))
          .map((lv) => (
            <article key={lv.id} className="rounded-3xl border border-cream/15 p-5">
              <p className="font-mono text-xs text-cream/45">{ctfLabel(lv.id)}</p>
              <h2 className="mt-1 text-lg font-medium">{lv.title}</h2>
              {solvedSet.has(lv.id) ? (
                <p className="mt-3 text-sm text-teal">{t.ctfDone}</p>
              ) : (
                <>
                  <p className="mt-3 text-sm leading-7 text-cream/70">{lv.statement}</p>
                  {lv.artifacts?.map((a) => (
                    <pre key={a} className="mt-3 overflow-x-auto font-mono text-xs text-teal">
                      {a}
                    </pre>
                  ))}
                  <HintBlock hints={lv.hints ?? []} label={t.hint} />
                  {lv.background && (
                    <details className="mt-4 text-xs text-cream/55">
                      <summary className="cursor-pointer">
                        {t.background}: {lv.background.title}
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {lv.background.refs.map((r) => (
                          <li key={r.url}>
                            <a className="text-teal underline" href={r.url} target="_blank" rel="noreferrer">
                              {r.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={flags[lv.id] ?? ""}
                      onChange={(e) => setFlags((f) => ({ ...f, [lv.id]: e.target.value }))}
                      placeholder="ZKCTF{…}"
                      className="min-h-12 flex-1 rounded-2xl border border-cream/15 bg-ink px-4 text-sm"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void submitLevel(lv)}
                      className="min-h-12 rounded-2xl bg-cream px-5 text-sm font-medium text-ink disabled:opacity-40"
                    >
                      {t.submit}
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
        {note && <p className="text-xs text-cream/55">{note}</p>}
      </div>

      <Leaderboard />
    </div>
  );
}

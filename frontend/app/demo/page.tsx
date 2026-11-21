"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { getJson, postJson } from "@/lib/api";
import { useLang } from "@/lib/lang";

type Level = {
  id: number;
  title: string;
  statement: string;
  artifacts: string[];
  hints: string[];
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

export default function DemoPage() {
  const { t } = useLang();
  const { publicKey, connected } = useWallet();
  const [levels, setLevels] = useState<Level[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [openId, setOpenId] = useState<number | null>(0);
  const [flags, setFlags] = useState<Record<number, string>>({});
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState(false);

  const sorted = useMemo(() => [...levels].sort((a, b) => a.id - b.id), [levels]);
  const solvedSet = useMemo(() => new Set(progress?.solved ?? []), [progress]);
  const nextId = progress?.next ?? (sorted[0]?.id ?? 0);
  const wallet = publicKey?.toBase58() ?? "guest";

  function isUnlocked(id: number) {
    if (solvedSet.has(id)) return true;
    return id === nextId;
  }

  function refreshProgress(w: string) {
    return getJson<Progress>(`/demo/progress/${w}`)
      .then((p) => {
        setProgress(p);
        if (p.next != null) setOpenId(p.next);
        else if (p.cleared && sorted.length) setOpenId(sorted[sorted.length - 1].id);
      })
      .catch(() => setProgress({ solved: [], next: 0, cleared: false, levelCount: levels.length }));
  }

  useEffect(() => {
    void getJson<{ levels: Level[] }>("/demo")
      .then((r) => {
        setLevels(r.levels ?? []);
        setLoadErr(false);
        if (r.levels?.[0]) setOpenId(r.levels[0].id);
      })
      .catch(() => {
        setLevels([]);
        setLoadErr(true);
      });
  }, []);

  useEffect(() => {
    void refreshProgress(wallet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, levels.length]);

  async function submitLevel(lv: Level) {
    setBusy(true);
    setNote(null);
    try {
      const out = await postJson<{ ok: boolean; note?: string; error?: string; progress?: Progress }>(
        "/demo/check",
        { wallet: connected ? wallet : "guest", level: lv.id, flag: flags[lv.id] ?? "" },
      );
      if (!out.ok) throw new Error(out.error ?? t.rejected);
      if (out.progress) setProgress(out.progress);
      setNote(out.note ?? t.saved);
      if (out.progress?.next != null) setOpenId(out.progress.next);
    } catch (e) {
      setNote(e instanceof Error ? e.message : t.rejected);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs uppercase tracking-[0.2em] text-teal">{t.demoBadge}</p>
      <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{t.demoTitle}</h1>
      <p className="mt-2 max-w-xl text-sm text-cream/60">{t.demoLead}</p>
      <p className="mt-4 rounded-2xl border border-teal/35 bg-teal/[0.07] px-4 py-3 text-sm text-cream/70">
        {t.demoFreeNote}
      </p>

      {loadErr && <p className="mt-3 text-sm text-teal">{t.roundLoadError}</p>}
      {progress?.cleared && (
        <div className="mt-6 rounded-3xl border border-teal/40 bg-teal/10 p-5">
          <p className="text-sm text-teal">{t.demoCleared}</p>
          <Link
            href="/play"
            className="mt-4 inline-flex min-h-12 items-center rounded-2xl bg-cream px-5 text-sm font-medium text-ink"
          >
            {t.demoCta}
          </Link>
        </div>
      )}

      <div className="mt-8 space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {sorted.map((lv) => {
            const unlocked = isUnlocked(lv.id);
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
                  CTF #{lv.id + 1}
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
          .filter((lv) => lv.id === openId && isUnlocked(lv.id))
          .map((lv) => (
            <article key={lv.id} className="rounded-3xl border border-cream/15 p-5">
              <p className="font-mono text-xs text-cream/45">CTF #{lv.id + 1}</p>
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

      <p className="mt-10 text-sm text-cream/50">
        {t.demoRaceHint}{" "}
        <Link href="/play" className="text-teal underline">
          /play
        </Link>
      </p>
    </div>
  );
}

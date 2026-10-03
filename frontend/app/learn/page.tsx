"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getJson, postJson } from "@/lib/api";
import { useLang } from "@/lib/lang";
import { Membership, type MemberStatus } from "@/components/Membership";
import { cachedAuth, walletAuth } from "@/lib/walletAuth";

type Track = { id: string; en: string; tr: string; es: string };
type Case = { name: string; date: string; impact?: string; sources?: string[] };
type LessonMeta = {
  id: string;
  week: string;
  track: string;
  title: string;
  summary: string;
  case: Case | null;
  authors?: { ai?: string | null; human?: string | null };
  publishedAt: string;
  early: boolean;
  unlocked: boolean;
  solved: boolean;
};
type Lesson = LessonMeta & {
  body: string;
  exercise: { statement: string; artifacts?: string[]; hints?: string[] };
};

function errorText(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  try {
    return JSON.parse(msg).error ?? msg;
  } catch {
    return msg;
  }
}

export default function LearnPage() {
  const { t, lang } = useLang();
  const { publicKey, signMessage } = useWallet();
  const wallet = publicKey?.toBase58();
  const [tracks, setTracks] = useState<Record<string, Track>>({});
  const [lessons, setLessons] = useState<LessonMeta[]>([]);
  const [member, setMember] = useState<MemberStatus | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState<Lesson | null>(null);
  const [hints, setHints] = useState(0);
  const [flag, setFlag] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void getJson<{ tracks: Record<string, Track>; lessons: LessonMeta[]; member: MemberStatus | null }>(
      `/lessons${wallet ? `?wallet=${wallet}` : ""}`,
      (wallet && cachedAuth(wallet)) || undefined,
    )
      .then((r) => {
        setTracks(r.tracks ?? {});
        setLessons(r.lessons ?? []);
        setMember(r.member);
      })
      .catch(() => setLessons([]));
  }, [wallet]);

  useEffect(load, [load]);

  async function openLesson(id: string) {
    if (open?.id === id) {
      setOpen(null);
      return;
    }
    setNote(null);
    setFlag("");
    setHints(0);
    if (!wallet) {
      setNote(t.connectFirst);
      return;
    }
    try {
      const firstSignIn = !cachedAuth(wallet);
      const auth = await walletAuth(wallet, signMessage);
      if (firstSignIn) load();
      const r = await getJson<{ lesson: Lesson; solved: boolean }>(`/lessons/${id}`, auth);
      const meta = lessons.find((l) => l.id === id);
      setOpen({ ...(meta as LessonMeta), ...r.lesson, solved: r.solved });
    } catch (e) {
      setOpen(null);
      setNote(errorText(e));
    }
  }

  async function submit() {
    if (!open || !wallet) return;
    setBusy(true);
    setNote(null);
    try {
      const auth = await walletAuth(wallet, signMessage);
      await postJson(`/lessons/${open.id}/validate`, { flag }, auth);
      setNote(t.lessonCorrect);
      setOpen({ ...open, solved: true });
      load();
    } catch (e) {
      setNote(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const label = (id: string) => tracks[id]?.[lang] ?? tracks[id]?.en ?? id;
  const shown = lessons.filter((l) => filter === "all" || l.track === filter);

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs uppercase tracking-[0.2em] text-teal">{t.learn}</p>
      <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{t.academyTitle}</h1>
      <p className="mt-3 text-sm leading-6 text-cream/65">{t.academyLead}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {["all", ...Object.keys(tracks)].map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              filter === id ? "bg-cream text-ink" : "border border-cream/15 text-cream/70"
            }`}
          >
            {id === "all" ? t.trackAll : label(id)}
          </button>
        ))}
      </div>

      {shown.length === 0 && <p className="mt-8 text-sm text-cream/50">{t.lessonEmpty}</p>}

      <ul className="mt-6 space-y-4">
        {shown.map((l) => (
          <li key={l.id} className="rounded-3xl border border-cream/15 p-5">
            <p className="font-mono text-[11px] text-teal">
              {l.week} · {label(l.track)}
              {l.early ? ` · ${t.lessonEarly}` : ""}
              {l.solved ? ` · ✓ ${t.lessonSolved}` : ""}
            </p>
            <h2 className="mt-2 text-lg font-medium">{l.title}</h2>
            <p className="mt-2 text-sm leading-6 text-cream/65">{l.summary}</p>
            {l.case && (
              <p className="mt-3 text-xs text-cream/50">
                {t.lessonCase}: {l.case.name} · {l.case.date}
                {l.case.impact ? ` · ${l.case.impact}` : ""}
              </p>
            )}
            {l.unlocked ? (
              <button
                type="button"
                onClick={() => void openLesson(l.id)}
                className="mt-4 min-h-11 rounded-2xl border border-cream/20 px-4 text-sm"
              >
                {open?.id === l.id ? t.lessonHide : t.lessonRead}
              </button>
            ) : (
              <p className="mt-4 text-xs text-cream/45">🔒 {t.lessonLocked}</p>
            )}

            {open?.id === l.id && (
              <article className="mt-5 border-t border-cream/10 pt-5">
                {open.body.split(/\n{2,}/).map((p, i) => (
                  <p key={i} className="mt-3 whitespace-pre-wrap text-sm leading-7 text-cream/75">
                    {p}
                  </p>
                ))}
                {open.case?.sources && open.case.sources.length > 0 && (
                  <div className="mt-4 text-xs text-cream/50">
                    {t.lessonSources}:{" "}
                    {open.case.sources.map((s) => (
                      <a key={s} href={s} target="_blank" rel="noreferrer" className="mr-2 break-all text-teal underline">
                        {s}
                      </a>
                    ))}
                  </div>
                )}
                <div className="mt-6 rounded-2xl border border-cream/10 p-4">
                  <p className="text-sm leading-6 text-cream/85">{open.exercise.statement}</p>
                  {open.exercise.artifacts?.map((a) => (
                    <pre key={a} className="mt-3 overflow-x-auto font-mono text-xs leading-5 text-teal">
                      {a}
                    </pre>
                  ))}
                  <button
                    type="button"
                    className="mt-4 text-xs text-cream/50 underline"
                    onClick={() => setHints((n) => n + 1)}
                  >
                    {t.hint}
                  </button>
                  {open.exercise.hints?.slice(0, hints).map((h) => (
                    <p key={h} className="mt-2 text-xs text-cream/55">
                      {h}
                    </p>
                  ))}
                  {open.solved ? (
                    <p className="mt-4 text-sm text-teal">✓ {t.lessonSolved}</p>
                  ) : (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <input
                        value={flag}
                        onChange={(e) => setFlag(e.target.value)}
                        placeholder="ZKCTF{…}"
                        className="min-h-12 flex-1 rounded-2xl border border-cream/15 bg-ink px-4 text-sm"
                      />
                      <button
                        type="button"
                        disabled={busy || !flag}
                        onClick={() => void submit()}
                        className="min-h-12 rounded-2xl bg-cream px-5 text-sm font-medium text-ink disabled:opacity-40"
                      >
                        {t.submit}
                      </button>
                    </div>
                  )}
                </div>
                {open.authors?.human && (
                  <p className="mt-3 text-[11px] text-cream/40">
                    {t.lessonReviewed} {open.authors.human}
                    {open.authors.ai ? ` · AI: ${open.authors.ai}` : ""}
                  </p>
                )}
              </article>
            )}
          </li>
        ))}
      </ul>
      {note && <p className="mt-4 text-xs text-cream/60">{note}</p>}

      {!member?.active && (
        <section className="mt-14">
          <h2 className="text-xl font-semibold">{t.membershipTitle}</h2>
          <p className="mt-2 text-sm text-cream/65">{t.membershipLead}</p>
          <div className="mt-6">
            <Membership onPaid={load} />
          </div>
        </section>
      )}
    </div>
  );
}

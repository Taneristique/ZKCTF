"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { deleteJson, getJson, postJson } from "@/lib/api";
import { walletAuth } from "@/lib/walletAuth";
import { useLang } from "@/lib/lang";

type ContestItem = {
  id: string;
  platform: string;
  title: string;
  url?: string | null;
  rank?: number | null;
  prizeUsdc?: number;
  severity?: string | null;
  finding?: string | null;
  at: number;
};

type Portfolio = {
  items: ContestItem[];
  platforms: Record<string, { id: string; label: string }>;
};

const EMPTY = {
  platform: "sherlock",
  title: "",
  url: "",
  rank: "",
  prizeUsdc: "",
  severity: "",
  finding: "",
};

export function ContestForm() {
  const { t } = useLang();
  const { publicKey, signMessage, connected } = useWallet();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setPortfolio(null);
      return;
    }
    void getJson<{ contests?: Portfolio }>(`/profile/${publicKey.toBase58()}`)
      .then((r) => setPortfolio(r.contests ?? null))
      .catch(() => setPortfolio(null));
  }, [publicKey]);

  if (!connected || !publicKey) return null;

  async function save() {
    if (!publicKey || !signMessage) return;
    setBusy(true);
    setNote(null);
    try {
      const headers = await walletAuth(publicKey.toBase58(), signMessage);
      const out = await postJson<{ ok: boolean; portfolio?: Portfolio; error?: string }>(
        "/contests",
        {
          platform: form.platform,
          title: form.title,
          url: form.url || undefined,
          rank: form.rank || undefined,
          prizeUsdc: form.prizeUsdc || undefined,
          severity: form.severity || undefined,
          finding: form.finding || undefined,
        },
        headers,
      );
      if (!out.ok) throw new Error(out.error ?? "Failed");
      setPortfolio(out.portfolio ?? null);
      setForm(EMPTY);
      setNote(t.contestsSaved);
    } catch (e) {
      setNote(e instanceof Error ? e.message : t.rejected);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!publicKey || !signMessage) return;
    setBusy(true);
    setNote(null);
    try {
      const headers = await walletAuth(publicKey.toBase58(), signMessage);
      const out = await deleteJson<{ ok: boolean; portfolio?: Portfolio }>(`/contests/${id}`, headers);
      setPortfolio(out.portfolio ?? null);
    } catch (e) {
      setNote(e instanceof Error ? e.message : t.rejected);
    } finally {
      setBusy(false);
    }
  }

  const platforms = portfolio?.platforms ?? {
    sherlock: { id: "sherlock", label: "Sherlock" },
    code4rena: { id: "code4rena", label: "Code4rena" },
    cantina: { id: "cantina", label: "Cantina" },
    codehawks: { id: "codehawks", label: "CodeHawks" },
    immunefi: { id: "immunefi", label: "Immunefi" },
    hackenproof: { id: "hackenproof", label: "HackenProof" },
    other: { id: "other", label: "Other" },
  };

  return (
    <section className="mt-8 rounded-3xl border border-cream/15 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-teal">{t.contestsAddTitle}</p>
      <p className="mt-2 text-sm leading-6 text-cream/65">{t.contestsAddLead}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-cream/45">
          {t.contestsPlatform}
          <select
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
            className="mt-1 min-h-11 w-full rounded-2xl border border-cream/15 bg-ink px-3 text-sm"
          >
            {Object.values(platforms).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-cream/45">
          {t.contestsProject}
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="mt-1 min-h-11 w-full rounded-2xl border border-cream/15 bg-ink px-3 text-sm"
          />
        </label>
        <label className="text-xs text-cream/45 sm:col-span-2">
          {t.contestsUrl}
          <input
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://"
            className="mt-1 min-h-11 w-full rounded-2xl border border-cream/15 bg-ink px-3 font-mono text-sm"
          />
        </label>
        <label className="text-xs text-cream/45">
          {t.contestsRank}
          <input
            value={form.rank}
            onChange={(e) => setForm({ ...form, rank: e.target.value })}
            inputMode="numeric"
            className="mt-1 min-h-11 w-full rounded-2xl border border-cream/15 bg-ink px-3 font-mono text-sm"
          />
        </label>
        <label className="text-xs text-cream/45">
          {t.contestsPrize}
          <input
            value={form.prizeUsdc}
            onChange={(e) => setForm({ ...form, prizeUsdc: e.target.value })}
            inputMode="decimal"
            className="mt-1 min-h-11 w-full rounded-2xl border border-cream/15 bg-ink px-3 font-mono text-sm"
          />
        </label>
        <label className="text-xs text-cream/45">
          {t.contestsSeverity}
          <select
            value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value })}
            className="mt-1 min-h-11 w-full rounded-2xl border border-cream/15 bg-ink px-3 text-sm"
          >
            <option value="">—</option>
            <option value="critical">critical</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
        </label>
        <label className="text-xs text-cream/45">
          {t.contestsFinding}
          <input
            value={form.finding}
            onChange={(e) => setForm({ ...form, finding: e.target.value })}
            className="mt-1 min-h-11 w-full rounded-2xl border border-cream/15 bg-ink px-3 text-sm"
          />
        </label>
      </div>
      <button
        type="button"
        disabled={busy || form.title.trim().length < 2}
        onClick={() => void save()}
        className="mt-4 min-h-11 rounded-2xl bg-cream px-5 text-sm font-medium text-ink disabled:opacity-40"
      >
        {t.contestsSave}
      </button>
      {note && <p className="mt-3 text-xs text-cream/55">{note}</p>}
      {(portfolio?.items?.length ?? 0) > 0 && (
        <ul className="mt-5 space-y-2 border-t border-cream/10 pt-4">
          {portfolio!.items.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 text-sm">
              <span className="min-w-0 text-cream/75">
                <span className="font-mono text-[10px] uppercase text-cream/40">
                  {platforms[c.platform]?.label ?? c.platform}
                </span>
                <br />
                {c.title}
                {c.rank != null ? ` · #${c.rank}` : ""}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove(c.id)}
                className="shrink-0 text-xs text-cream/45 underline"
              >
                {t.contestsRemove}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

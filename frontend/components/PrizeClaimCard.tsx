"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getJson, postJson } from "@/lib/api";
import { walletAuth } from "@/lib/walletAuth";
import { useLang } from "@/lib/lang";

type Claim = {
  round: number | string;
  day?: string | null;
  rank: number;
  prizeUsdc: number;
  atoms: number;
  status: string;
  settleSig?: string | null;
  claimSig?: string | null;
  reason?: string;
};

export function PrizeClaimCard() {
  const { t } = useLang();
  const { publicKey, signMessage, connected } = useWallet();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!publicKey) {
      setClaims([]);
      return;
    }
    void getJson<{ claimable?: Claim[]; claims?: Claim[] }>(`/prize/claims/${publicKey.toBase58()}`)
      .then((r) => setClaims(r.claimable?.length ? r.claimable : (r.claims ?? []).filter((c) => c.status === "claimable")))
      .catch(() => setClaims([]));
  }, [publicKey]);

  useEffect(load, [load]);

  if (!connected || !publicKey || claims.length === 0) return null;

  async function claim(round: number | string) {
    if (!publicKey || !signMessage) return;
    setBusy(String(round));
    setNote(null);
    try {
      const headers = await walletAuth(publicKey.toBase58(), signMessage);
      const out = await postJson<{ ok: boolean; prizeUsdc?: number; sig?: string; error?: string; note?: string }>(
        "/prize/claim",
        { round },
        headers,
      );
      if (!out.ok) throw new Error(out.error ?? "Claim failed");
      setNote(out.note ?? `${t.prizeClaimed} ${out.prizeUsdc} USDC`);
      load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : t.rejected);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-8 rounded-3xl border border-teal/35 bg-teal/[0.06] p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-teal">{t.prizeClaimTitle}</p>
      <p className="mt-2 text-sm leading-6 text-cream/70">{t.prizeClaimLead}</p>
      <ul className="mt-4 space-y-3">
        {claims.map((c) => (
          <li
            key={String(c.round)}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cream/10 px-4 py-3"
          >
            <div>
              <p className="font-mono text-sm text-cream">
                #{c.rank} · {c.day ?? c.round} · {Number(c.prizeUsdc).toFixed(2)} USDC
              </p>
              <p className="mt-1 text-[11px] text-cream/45">{t.prizeClaimRescue}</p>
            </div>
            <button
              type="button"
              disabled={busy === String(c.round)}
              onClick={() => void claim(c.round)}
              className="min-h-11 rounded-2xl bg-cream px-4 text-sm font-medium text-ink disabled:opacity-40"
            >
              {busy === String(c.round) ? "…" : t.prizeClaimAction}
            </button>
          </li>
        ))}
      </ul>
      {note && <p className="mt-3 text-xs text-cream/55">{note}</p>}
    </section>
  );
}

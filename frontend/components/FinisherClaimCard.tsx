"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getJson, postJson } from "@/lib/api";
import { walletAuth } from "@/lib/walletAuth";
import { useLang } from "@/lib/lang";

type Claim = {
  round: number;
  day?: string;
  status: string;
  reason?: string;
};

type LoyaltySnap = {
  count?: number;
  claimable?: Claim[];
};

export function FinisherClaimCard({ onMinted }: { onMinted?: () => void }) {
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
    const w = publicKey.toBase58();
    void getJson<LoyaltySnap>(`/loyalty/${w}`)
      .then((r) => setClaims(r.claimable ?? []))
      .catch(() =>
        getJson<{ claimable?: Claim[] }>(`/loyalty/claims/${w}`)
          .then((r) => setClaims(r.claimable ?? []))
          .catch(() => setClaims([])),
      );
  }, [publicKey]);

  useEffect(load, [load]);

  if (!connected || !publicKey || claims.length === 0) return null;

  async function claim(round: number) {
    if (!publicKey || !signMessage) return;
    setBusy(String(round));
    setNote(null);
    try {
      const headers = await walletAuth(publicKey.toBase58(), signMessage);
      const out = await postJson<{ ok: boolean; count?: number; note?: string; error?: string }>(
        "/loyalty/claim",
        { round },
        headers,
      );
      if (!out.ok) throw new Error(out.error ?? "Mint failed");
      setNote(out.note ?? t.loyaltyClaimed);
      load();
      onMinted?.();
    } catch (e) {
      setNote(e instanceof Error ? e.message : t.rejected);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t border-cream/10 pt-4">
      <p className="text-xs uppercase tracking-[0.2em] text-cream/45">{t.loyaltyClaimTitle}</p>
      <p className="text-sm text-cream/55">{t.loyaltyClaimLead}</p>
      <ul className="space-y-2">
        {claims.map((c) => (
          <li
            key={c.round}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cream/10 px-4 py-3"
          >
            <p className="font-mono text-sm text-cream">
              {c.day ?? c.round} · +1 Finisher
            </p>
            <button
              type="button"
              disabled={busy === String(c.round)}
              onClick={() => void claim(c.round)}
              className="min-h-10 rounded-2xl bg-cream px-4 text-sm font-medium text-ink disabled:opacity-40"
            >
              {busy === String(c.round) ? "…" : t.loyaltyClaimAction}
            </button>
          </li>
        ))}
      </ul>
      {note && <p className="text-xs text-cream/55">{note}</p>}
    </div>
  );
}

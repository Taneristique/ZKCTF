"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getJson, postJson } from "@/lib/api";
import { walletAuth } from "@/lib/walletAuth";
import { sendB64Tx } from "@/lib/program";
import { useLang } from "@/lib/lang";

type Gift = {
  finishes: number;
  need: number;
  months: number;
  claimed: boolean;
  eligible: boolean;
  note: string;
};

export function AcademyGiftCard() {
  const { t } = useLang();
  const { publicKey, connected, signMessage, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [gift, setGift] = useState<Gift | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh(w: string) {
    return getJson<Gift>(`/gift/academy/${w}`)
      .then(setGift)
      .catch(() => setGift(null));
  }

  useEffect(() => {
    if (!publicKey) {
      setGift(null);
      return;
    }
    void refresh(publicKey.toBase58());
  }, [publicKey]);

  async function claim() {
    if (!publicKey || !signMessage || !sendTransaction) return;
    setBusy(true);
    setNote(null);
    try {
      const headers = await walletAuth(publicKey.toBase58(), signMessage);
      const out = await postJson<{ tx: string; note?: string }>("/gift/academy", { wallet: publicKey.toBase58() }, headers);
      const sig = await sendB64Tx(connection, sendTransaction, out.tx);
      await postJson("/gift/academy/confirm", { wallet: publicKey.toBase58(), signature: sig });
      setNote(out.note ?? t.giftClaimed);
      await refresh(publicKey.toBase58());
    } catch (e) {
      setNote(e instanceof Error ? e.message : t.rejected);
    } finally {
      setBusy(false);
    }
  }

  if (!connected) return null;

  return (
    <section className="mt-8 rounded-3xl border border-teal/40 bg-teal/[0.07] p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-teal">{t.giftTitle}</p>
      <p className="mt-2 text-sm leading-6 text-cream/70">{t.giftLead}</p>
      {gift && (
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-cream/45">{t.giftProgress}</dt>
          <dd className="text-right font-mono">
            {gift.finishes} / {gift.need}
          </dd>
          <dt className="text-cream/45">{t.giftReward}</dt>
          <dd className="text-right">
            {gift.months} {t.month1.replace(/^1\s*/, "").trim() || "month"}
          </dd>
        </dl>
      )}
      {gift?.eligible && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void claim()}
          className="mt-4 inline-flex min-h-12 items-center rounded-2xl bg-cream px-5 text-sm font-medium text-ink disabled:opacity-40"
        >
          {t.giftClaim}
        </button>
      )}
      {gift?.claimed && <p className="mt-3 text-sm text-teal">{t.giftDone}</p>}
      {gift && !gift.eligible && !gift.claimed && (
        <p className="mt-3 text-sm text-cream/55">{gift.note}</p>
      )}
      {note && <p className="mt-3 text-xs text-cream/55">{note}</p>}
    </section>
  );
}

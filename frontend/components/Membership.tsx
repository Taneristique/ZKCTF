"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getJson, postJson } from "@/lib/api";
import { useLang } from "@/lib/lang";
import { sendB64Tx } from "@/lib/program";

type Plan = { months: number; usdc: number; priceUsdc: number };
export type MemberStatus = { active: boolean; founding: boolean; expiry: number | null };
type Plans = {
  plans: Plan[];
  foundingPlans: Plan[];
  founding: { seats: number; left: number; eligible: boolean; member: boolean; earlyAccessHours: number };
  member: MemberStatus | null;
};

/** Academy membership: USDC transfer + on-chain seat in one wallet-signed transaction. */
export function Membership({ onPaid }: { onPaid?: () => void }) {
  const { t } = useLang();
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [data, setData] = useState<Plans | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const wallet = publicKey?.toBase58();
  const load = useCallback(() => {
    void getJson<Plans>(`/plans${wallet ? `?wallet=${wallet}` : ""}`)
      .then(setData)
      .catch(() => setData(null));
  }, [wallet]);

  useEffect(load, [load]);

  async function pay(months: number) {
    if (!publicKey || !sendTransaction) {
      setNote(t.connectFirst);
      return;
    }
    setBusy(months);
    setNote(null);
    try {
      const out = await postJson<{ tx: string; note: string }>("/checkout", { wallet: publicKey.toBase58(), months });
      setNote(t.paying);
      const sig = await sendB64Tx(connection, sendTransaction, out.tx);
      await connection.confirmTransaction(sig, "confirmed");
      setNote(`${t.paid} ${out.note}`);
      load();
      onPaid?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      try {
        setNote(JSON.parse(msg).error ?? msg);
      } catch {
        setNote(msg);
      }
    } finally {
      setBusy(null);
    }
  }

  const label = (m: number) => (m === 1 ? t.month1 : m === 3 ? t.month3 : t.month12);
  const founding = data?.founding;
  const plans = founding?.eligible ? data?.foundingPlans : data?.plans;
  const member = data?.member;

  return (
    <div>
      <div className="rounded-3xl border border-teal/40 bg-teal/[0.07] p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-teal">{t.foundingTitle}</p>
        <p className="mt-2 text-sm leading-6 text-cream/75">{t.foundingLead}</p>
        {founding && (
          <p className="mt-3 font-mono text-xs text-teal">
            {founding.member
              ? t.foundingYou
              : founding.left > 0
                ? `${t.foundingLeft}: ${founding.left} / ${founding.seats}`
                : t.foundingGone}
          </p>
        )}
      </div>

      {member?.active && member.expiry && (
        <p className="mt-4 text-sm text-teal">
          {member.founding ? t.tierFounding : t.tierMember} · {t.memberUntil}{" "}
          {new Date(member.expiry).toISOString().slice(0, 10)}
        </p>
      )}

      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
        {(plans ?? []).map((p) => (
          <li key={p.months} className="flex flex-col rounded-3xl border border-cream/15 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-cream/45">{label(p.months)}</p>
            <p className="mt-3 text-3xl font-semibold">
              {p.priceUsdc}
              <span className="text-base font-normal text-cream/45"> USDC</span>
            </p>
            {p.priceUsdc < p.usdc && <p className="mt-1 text-xs text-cream/45 line-through">{p.usdc} USDC</p>}
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void pay(p.months)}
              className="mt-5 min-h-11 rounded-2xl bg-cream px-4 text-sm font-medium text-ink disabled:opacity-40"
            >
              {busy === p.months ? t.paying : t.payUsdc}
            </button>
          </li>
        ))}
      </ul>
      {note && <p className="mt-3 break-words text-xs text-cream/60">{note}</p>}
      {!publicKey && <p className="mt-3 text-xs text-cream/45">{t.connectFirst}</p>}
    </div>
  );
}

"use client";

import { useEffect, useState, Suspense } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getJson } from "@/lib/api";
import { useLang } from "@/lib/lang";

type Member = {
  active: boolean;
  founding?: boolean;
  expiry?: number | null;
};

type Prestige = {
  points?: number;
  badge?: string;
  lifetime?: number;
  season?: string;
};

function AccountBody() {
  const { t } = useLang();
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [member, setMember] = useState<Member | null>(null);
  const [entered, setEntered] = useState(false);
  const [sol, setSol] = useState<number | null>(null);
  const [prestige, setPrestige] = useState<Prestige | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setMember(null);
      setEntered(false);
      setSol(null);
      setPrestige(null);
      return;
    }
    const w = publicKey.toBase58();
    void getJson<Member>(`/membership/${w}`).then(setMember);
    void getJson<{ entered?: boolean }>(`/entry/${w}`).then((r) => setEntered(Boolean(r.entered)));
    void getJson<Prestige>(`/prestige/${w}`).then(setPrestige).catch(() => setPrestige(null));
    void connection.getBalance(publicKey).then((l) => setSol(l / LAMPORTS_PER_SOL));
  }, [publicKey, connection]);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold sm:text-3xl">{t.account}</h1>
      <p className="mt-3 text-sm text-cream/60">
        {t.accountLead}{" "}
        <a className="text-teal underline" href="https://faucet.solana.com" target="_blank" rel="noreferrer">
          faucet.solana.com
        </a>
        {" · "}
        <a className="text-teal underline" href="https://faucet.circle.com" target="_blank" rel="noreferrer">
          faucet.circle.com
        </a>
      </p>
      <dl className="mt-8 grid grid-cols-2 gap-3 rounded-3xl border border-cream/15 p-5 text-sm">
        <dt className="text-cream/45">Wallet</dt>
        <dd className="text-right font-mono text-xs">
          {connected && publicKey ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}` : "—"}
        </dd>
        <dt className="text-cream/45">Balance</dt>
        <dd className="text-right font-mono">{sol == null ? "—" : `${sol.toFixed(4)} SOL`}</dd>
        <dt className="text-cream/45">This week</dt>
        <dd className="text-right">{entered ? "5 USDC" : "—"}</dd>
        <dt className="text-cream/45">{t.membership}</dt>
        <dd className="text-right">
          {member?.expiry ? (member.founding ? t.tierFounding : t.tierMember) : "—"}
          {member?.expiry && !member.active ? " (expired)" : ""}
        </dd>
        <dt className="text-cream/45">{t.memberUntil}</dt>
        <dd className="text-right font-mono text-xs">
          {member?.expiry ? new Date(member.expiry).toISOString().slice(0, 10) : "—"}
        </dd>
        <dt className="text-cream/45">{t.seasonPoints}</dt>
        <dd className="text-right font-mono">{prestige?.points ?? "—"}</dd>
        <dt className="text-cream/45">{t.seasonBadge}</dt>
        <dd className="text-right capitalize">{prestige?.badge && prestige.badge !== "none" ? prestige.badge : "—"}</dd>
      </dl>
      <p className="mt-3 text-xs text-cream/45">{t.prestigeNote}</p>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-lg text-sm text-cream/50">…</div>}>
      <AccountBody />
    </Suspense>
  );
}

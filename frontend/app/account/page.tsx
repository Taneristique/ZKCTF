"use client";

import { useEffect, useState, Suspense } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getJson } from "@/lib/api";
import { useLang } from "@/lib/lang";
import { tokenBalance } from "@/lib/program";

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

type Founder = { founder: boolean; ordinal: number | null; carried: boolean };

type Loyalty = {
  count: number;
  tier: "finisher" | "veteran" | "elite" | null;
  perks: string[];
  next: { id: string; min: number } | null;
};

const PERK_KEY = {
  eliteEvents: "perkEliteEvents",
  earlyLessons: "perkEarlyLessons",
  hallOfFame: "perkHallOfFame",
  holderRole: "perkHolderRole",
  betaAccess: "perkBetaAccess",
} as const;

const TIER_KEY = { finisher: "tierFinisher", veteran: "tierVeteran", elite: "tierElite" } as const;

function AccountBody() {
  const { t } = useLang();
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [member, setMember] = useState<Member | null>(null);
  const [entered, setEntered] = useState(false);
  const [sol, setSol] = useState<number | null>(null);
  const [usdc, setUsdc] = useState<number | null>(null);
  const [prestige, setPrestige] = useState<Prestige | null>(null);
  const [founder, setFounder] = useState<Founder | null>(null);
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setMember(null);
      setEntered(false);
      setSol(null);
      setUsdc(null);
      setPrestige(null);
      setFounder(null);
      setLoyalty(null);
      return;
    }
    const w = publicKey.toBase58();
    void getJson<Founder>(`/founders/${w}`).then(setFounder).catch(() => setFounder(null));
    void getJson<Loyalty>(`/loyalty/${w}`).then(setLoyalty).catch(() => setLoyalty(null));
    void getJson<Member>(`/membership/${w}`).then(setMember);
    void getJson<{ entered?: boolean }>(`/entry/${w}`).then((r) => setEntered(Boolean(r.entered)));
    void getJson<Prestige>(`/prestige/${w}`).then(setPrestige).catch(() => setPrestige(null));
    void connection.getBalance(publicKey).then((l) => setSol(l / LAMPORTS_PER_SOL));
    void tokenBalance(connection, publicKey).then(setUsdc).catch(() => setUsdc(null));
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
        <dt className="text-cream/45">{t.accWallet}</dt>
        <dd className="text-right font-mono text-xs">
          {connected && publicKey ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}` : "—"}
        </dd>
        <dt className="text-cream/45">{t.accUsdc}</dt>
        <dd className="text-right font-mono">{usdc == null ? "—" : `${usdc.toFixed(2)} USDC`}</dd>
        <dt className="text-cream/45">{t.accGas}</dt>
        <dd className="text-right font-mono text-xs text-cream/60">{sol == null ? "—" : `${sol.toFixed(4)} SOL`}</dd>
        <dt className="text-cream/45">{t.accWeek}</dt>
        <dd className="text-right">{entered ? "5 USDC" : "—"}</dd>
        <dt className="text-cream/45">{t.membership}</dt>
        <dd className="text-right">
          {member?.expiry ? (member.founding ? t.tierFounding : t.tierMember) : "—"}
          {member?.expiry && !member.active ? ` (${t.accExpired})` : ""}
        </dd>
        <dt className="text-cream/45">{t.accFounder}</dt>
        <dd className="text-right font-mono text-xs text-teal">
          {founder?.founder ? `${t.founderNo}${founder.ordinal ?? "?"}` : "—"}
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

      <section className="mt-8 rounded-3xl border border-teal/40 bg-teal/[0.07] p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-teal">{t.loyaltyTitle}</p>
        <p className="mt-2 text-sm leading-6 text-cream/70">{t.loyaltyLead}</p>
        {loyalty?.tier ? (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-cream/45">{t.loyaltyTier}</dt>
              <dd className="text-right font-medium text-teal">{t[TIER_KEY[loyalty.tier]]}</dd>
              <dt className="text-cream/45">{t.loyaltyCount}</dt>
              <dd className="text-right font-mono">{loyalty.count}</dd>
              {loyalty.next && (
                <>
                  <dt className="text-cream/45">{t.loyaltyNext}</dt>
                  <dd className="text-right font-mono text-xs">
                    {loyalty.next.min} · {t[TIER_KEY[loyalty.next.id as keyof typeof TIER_KEY]]}
                  </dd>
                </>
              )}
            </dl>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-cream/45">{t.loyaltyPerks}</p>
            <ul className="mt-2 space-y-1 text-sm text-cream/75">
              {loyalty.perks.map((p) => (
                <li key={p}>· {t[PERK_KEY[p as keyof typeof PERK_KEY]] ?? p}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-3 text-sm text-cream/55">{connected ? t.loyaltyNone : t.connectFirst}</p>
        )}
      </section>
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getJson } from "@/lib/api";
import { useLang } from "@/lib/lang";
import { avatarUrl } from "@/lib/avatar";

type PublicCard = {
  profile: { pseudonym: string; createdAt: number } | null;
  wallet: string;
  shortWallet: string;
  finishes: number;
  tier: string | null;
  founding: boolean;
  founderOrdinal: number | null;
  academyMember: boolean;
  weekWins: number;
  firstPlaces: number;
  top10: number;
  weekNfts: { round: number; rank: number; mint: string }[];
  prestige: { points?: number; badge?: string; lifetime?: number } | null;
};

export default function PublicProfilePage() {
  const { t } = useLang();
  const params = useParams();
  const name = String(params?.name ?? "");
  const [card, setCard] = useState<PublicCard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!name) return;
    void getJson<PublicCard>(`/u/${encodeURIComponent(name)}`)
      .then(setCard)
      .catch((e) => setErr(e instanceof Error ? e.message : "Not found"));
  }, [name]);

  if (err) {
    return (
      <div className="mx-auto max-w-lg">
        <p className="text-sm text-cream/60">{err}</p>
        <Link href="/play" className="mt-4 inline-block text-teal underline">
          {t.play}
        </Link>
      </div>
    );
  }

  if (!card?.profile) {
    return <p className="mx-auto max-w-lg text-sm text-cream/50">…</p>;
  }

  const since = new Date(card.profile.createdAt).toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-lg">
      <p className="text-xs uppercase tracking-[0.2em] text-teal">{t.publicProfileBadge}</p>
      <div className="mt-4 flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl(card.profile.pseudonym, 160)}
          alt=""
          width={80}
          height={80}
          className="size-20 rounded-full border border-cream/15 bg-ink"
        />
        <div>
          <h1 className="font-mono text-3xl font-semibold text-cream sm:text-4xl">{card.profile.pseudonym}</h1>
          <p className="mt-2 font-mono text-xs text-cream/45">
            {card.shortWallet} · {t.publicSince} {since}
          </p>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-3 rounded-3xl border border-cream/15 p-5 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-cream/45">{t.publicFinishes}</dt>
          <dd className="mt-1 font-mono text-xl text-teal">{card.finishes}</dd>
        </div>
        <div>
          <dt className="text-cream/45">{t.publicTop10}</dt>
          <dd className="mt-1 font-mono text-xl">{card.top10}</dd>
        </div>
        <div>
          <dt className="text-cream/45">{t.publicFirst}</dt>
          <dd className="mt-1 font-mono text-xl">{card.firstPlaces}</dd>
        </div>
        <div>
          <dt className="text-cream/45">{t.loyaltyTier}</dt>
          <dd className="mt-1 capitalize">{card.tier ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-cream/45">{t.accFounder}</dt>
          <dd className="mt-1">{card.founding ? `#${card.founderOrdinal ?? "?"}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-cream/45">{t.membership}</dt>
          <dd className="mt-1">{card.academyMember ? t.tierMember : "—"}</dd>
        </div>
      </dl>

      {card.weekNfts.length > 0 && (
        <section className="mt-8">
          <p className="text-xs uppercase tracking-[0.2em] text-cream/45">{t.weekNftTitle}</p>
          <ul className="mt-3 divide-y divide-cream/10 rounded-3xl border border-cream/15">
            {card.weekNfts.map((n) => (
              <li key={`${n.round}-${n.mint}`} className="flex items-center gap-3 px-4 py-3 font-mono text-xs">
                <span className="text-teal">#{n.rank}</span>
                <span className="flex-1 text-cream/70">{new Date(n.round * 1000).toISOString().slice(0, 10)}</span>
                <span className="text-cream/40">{n.mint.slice(0, 8)}…</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-sm text-cream/50">
        <Link href="/play" className="text-teal underline">
          {t.play}
        </Link>
        {" · "}
        <Link href="/account" className="text-teal underline">
          {t.account}
        </Link>
      </p>
    </div>
  );
}

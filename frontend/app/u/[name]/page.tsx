"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getJson } from "@/lib/api";
import { useLang } from "@/lib/lang";
import { Avatar } from "@/components/Avatar";

type Host = { id: string; name: string; logo?: string | null };
type Activity = {
  day: string;
  date: string;
  round: number;
  rank: number;
  prizeUsdc: number;
  title: string;
  host: Host;
  medal: string;
  mint?: string;
};

type LiveWeek = {
  place: number | null;
  cleared: boolean;
  finishTime?: number | null;
  solved?: number;
  levelCount?: number;
  projected?: boolean;
  note?: string;
};

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
  secondPlaces?: number;
  thirdPlaces?: number;
  top10: number;
  prestige?: { points: number; badge: string; lifetime: number } | null;
  liveWeek?: LiveWeek | null;
  medals?: {
    payouts: number;
    first: number;
    second: number;
    third: number;
    earnedUsdc: number;
  };
  activity?: (Activity & { live?: boolean })[];
  weekNfts: { round: number; rank: number; mint: string }[];
  sharePath?: string;
  research?: { id: string; label: string; handle: string; href?: string | null; verified?: boolean }[];
};

function medalDot(medal: string) {
  if (medal === "gold") return "bg-amber-400";
  if (medal === "silver") return "bg-cream/70";
  if (medal === "bronze") return "bg-orange-700/80";
  return "bg-teal/50";
}

export default function PublicProfilePage() {
  const { t } = useLang();
  const params = useParams();
  const name = String(params?.name ?? "");
  const [card, setCard] = useState<PublicCard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);

  useEffect(() => {
    if (!name) return;
    void getJson<PublicCard>(`/u/${encodeURIComponent(name)}`)
      .then(setCard)
      .catch((e) => setErr(e instanceof Error ? e.message : "Not found"));
  }, [name]);

  async function copyShare() {
    const path = card?.sharePath ?? `/u/${name}`;
    const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
    try {
      await navigator.clipboard.writeText(url);
      setShareNote(t.profileShared);
    } catch {
      setShareNote(url);
    }
  }

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
  const m = card.medals;
  const live = card.liveWeek;
  const prestige = card.prestige;
  const hasPrestige = Boolean(prestige && (prestige.points > 0 || prestige.lifetime > 0));

  return (
    <div className="mx-auto max-w-lg">
      <p className="text-xs uppercase tracking-[0.2em] text-teal">{t.publicProfileBadge}</p>
      <div className="mt-4 flex items-center gap-4">
        <Avatar seed={card.profile.pseudonym} size="xl" />
        <div className="min-w-0 flex-1">
          <h1 className="font-mono text-3xl font-semibold text-cream sm:text-4xl">{card.profile.pseudonym}</h1>
          <p className="mt-2 font-mono text-xs text-cream/45">
            {card.shortWallet} · {t.publicSince} {since}
          </p>
          <button
            type="button"
            onClick={() => void copyShare()}
            className="mt-3 text-xs text-teal underline"
          >
            {t.profileShare}
          </button>
          {shareNote && <p className="mt-1 text-[11px] text-cream/45">{shareNote}</p>}
        </div>
      </div>

      {(card.research?.length ?? 0) > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {card.research!.map((r) =>
            r.href ? (
              <a
                key={r.id}
                href={r.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-cream/15 px-3 py-1.5 font-mono text-xs text-teal"
              >
                {r.label} · {r.handle}
              </a>
            ) : (
              <span
                key={r.id}
                className="rounded-full border border-cream/15 px-3 py-1.5 font-mono text-xs text-cream/70"
              >
                {r.label} · {r.handle}
              </span>
            ),
          )}
        </div>
      )}

      {live?.cleared && live.place != null && (
        <div className="mt-8 rounded-3xl border border-teal/35 bg-teal/[0.07] px-5 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-teal">{t.liveWeekTitle}</p>
          <p className="mt-2 font-mono text-2xl text-cream">
            #{live.place}
            <span className="ml-2 text-sm text-cream/55">{t.liveWeekPlace}</span>
          </p>
          <p className="mt-2 text-xs text-cream/50">{t.liveWeekNote}</p>
        </div>
      )}

      {/* Original profile stats (always when any exist) — ZKCTF account card language */}
      <dl className="mt-8 grid grid-cols-2 gap-3 rounded-3xl border border-cream/15 p-5 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-cream/45">{t.accWallet}</dt>
          <dd className="mt-1 font-mono text-xs text-cream/70">{card.shortWallet}</dd>
        </div>
        {hasPrestige && (
          <>
            {prestige!.lifetime > 0 && (
              <div>
                <dt className="text-cream/45">{t.lifetimePoints}</dt>
                <dd className="mt-1 font-mono text-xl text-teal">{prestige!.lifetime}</dd>
              </div>
            )}
            {prestige!.points > 0 && (
              <div>
                <dt className="text-cream/45">{t.seasonPoints}</dt>
                <dd className="mt-1 font-mono text-xl text-teal">{prestige!.points}</dd>
              </div>
            )}
            {prestige!.badge && prestige!.badge !== "none" && (
              <div>
                <dt className="text-cream/45">{t.seasonBadge}</dt>
                <dd className="mt-1 capitalize">{prestige!.badge}</dd>
              </div>
            )}
          </>
        )}
        {card.founding && (
          <div>
            <dt className="text-cream/45">{t.accFounder}</dt>
            <dd className="mt-1 font-mono text-teal">#{card.founderOrdinal ?? "?"}</dd>
          </div>
        )}
        {card.academyMember && (
          <div>
            <dt className="text-cream/45">{t.membership}</dt>
            <dd className="mt-1">{t.tierMember}</dd>
          </div>
        )}
        {card.finishes > 0 && (
          <div>
            <dt className="text-cream/45">{t.publicFinishes}</dt>
            <dd className="mt-1 font-mono text-xl text-teal">{card.finishes}</dd>
          </div>
        )}
        {card.top10 > 0 && (
          <div>
            <dt className="text-cream/45">{t.publicTop10}</dt>
            <dd className="mt-1 font-mono text-xl">{card.top10}</dd>
          </div>
        )}
        {card.tier && (
          <div>
            <dt className="text-cream/45">{t.loyaltyTier}</dt>
            <dd className="mt-1 capitalize">{card.tier}</dd>
          </div>
        )}
      </dl>

      {/* Extra: place/prize chips only when earned — never 0x */}
      {m && (m.payouts > 0 || m.first > 0 || m.second > 0 || m.third > 0) && (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {m.payouts > 0 && (
              <div className="rounded-2xl border border-cream/15 px-3 py-3">
                <dt className="text-[10px] uppercase tracking-wider text-cream/45">{t.medalPayouts}</dt>
                <dd className="mt-1 font-mono text-xl text-teal">
                  {m.payouts}
                  <span className="text-xs text-cream/40">×</span>
                </dd>
              </div>
            )}
            {m.first > 0 && (
              <div className="rounded-2xl border border-teal/30 px-3 py-3">
                <dt className="text-[10px] uppercase tracking-wider text-teal/80">{t.medalFirst}</dt>
                <dd className="mt-1 font-mono text-xl text-teal">
                  {m.first}
                  <span className="text-xs text-cream/40">×</span>
                </dd>
              </div>
            )}
            {m.second > 0 && (
              <div className="rounded-2xl border border-cream/20 px-3 py-3">
                <dt className="text-[10px] uppercase tracking-wider text-cream/50">{t.medalSecond}</dt>
                <dd className="mt-1 font-mono text-xl text-cream/80">
                  {m.second}
                  <span className="text-xs text-cream/40">×</span>
                </dd>
              </div>
            )}
            {m.third > 0 && (
              <div className="rounded-2xl border border-cream/15 px-3 py-3">
                <dt className="text-[10px] uppercase tracking-wider text-cream/45">{t.medalThird}</dt>
                <dd className="mt-1 font-mono text-xl text-cream/70">
                  {m.third}
                  <span className="text-xs text-cream/40">×</span>
                </dd>
              </div>
            )}
          </dl>
          {m.earnedUsdc > 0 && (
            <p className="mt-3 font-mono text-sm text-teal">
              {t.medalEarned}: {m.earnedUsdc.toFixed(2)} USDC
            </p>
          )}
        </>
      )}

      {/* Activity feed only when there is something to celebrate */}
      {card.activity && card.activity.length > 0 && (
        <section className="mt-10">
          <p className="text-xs uppercase tracking-[0.2em] text-cream/45">{t.activityTitle}</p>
          <p className="mt-2 text-sm text-cream/50">{t.activityLead}</p>
          <ul className="mt-5 space-y-6">
            {card.activity.map((a) => (
              <li key={`${a.round}-${a.rank}-${a.mint ?? ""}`} className="relative pl-4">
                <span className={`absolute left-0 top-2 size-2 rounded-full ${medalDot(a.medal)}`} />
                <p className="font-mono text-[10px] uppercase tracking-wider text-cream/40">{a.date}</p>
                <div className="mt-2 flex gap-3 rounded-2xl border border-cream/10 p-3">
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-xl border border-cream/10 bg-ink">
                    {a.host.logo?.startsWith("http") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.host.logo} alt={a.host.name} width={40} height={40} className="size-10 object-cover" />
                    ) : a.host.logo ? (
                      <Image src={a.host.logo} alt={a.host.name} width={40} height={40} className="size-10 object-cover" />
                    ) : (
                      <span className="flex size-10 items-center justify-center text-[10px] text-teal">ZK</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-cream/90">{a.title}</p>
                    <p className="mt-0.5 text-xs text-cream/50">
                      {a.host.name} · {a.day}
                    </p>
                    <p className="mt-2 font-mono text-xs text-teal">
                      #{a.rank}
                      {a.prizeUsdc > 0 ? ` · ${a.prizeUsdc.toFixed(2)} USDC` : ""}
                      {a.live ? ` · ${t.liveWeekBadge}` : ""}
                    </p>
                  </div>
                </div>
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getJson } from "@/lib/api";
import { useLang } from "@/lib/lang";
import { avatarUrl } from "@/lib/avatar";

type Row = {
  wallet: string;
  place?: number;
  displayName?: string;
  pseudonym?: string | null;
  prizeUsdc?: number;
  paid?: boolean;
  finishTs?: number;
};

type Board = {
  ranked: Row[];
  nWinners: number;
  potUsdc?: number;
  prizePoolUsdc?: number;
  source: string;
  asset?: string;
};

function placeLabel(place: number, t: { place1: string; place2: string; place3: string; placeN: string }) {
  if (place === 1) return t.place1;
  if (place === 2) return t.place2;
  if (place === 3) return t.place3;
  return t.placeN.replace("{n}", String(place));
}

export function Leaderboard() {
  const { t } = useLang();
  const [board, setBoard] = useState<Board | null>(null);

  useEffect(() => {
    void getJson<Board>("/leaderboard")
      .then(setBoard)
      .catch(() => setBoard(null));
    const id = setInterval(() => {
      void getJson<Board>("/leaderboard")
        .then(setBoard)
        .catch(() => undefined);
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!board?.ranked?.length) {
    return (
      <section className="mt-12">
        <p className="text-xs uppercase tracking-[0.2em] text-teal">{t.boardTitle}</p>
        <p className="mt-2 text-sm text-cream/55">{t.boardEmpty}</p>
      </section>
    );
  }

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-teal">{t.boardTitle}</p>
          <p className="mt-2 text-sm text-cream/55">{t.boardLead}</p>
        </div>
        {board.potUsdc != null && board.potUsdc > 0 && (
          <p className="font-mono text-xs text-cream/45">
            {t.boardPot}: {board.potUsdc.toFixed(2)} USDC
            {board.prizePoolUsdc != null ? ` · ${t.boardPrizePool}: ${board.prizePoolUsdc.toFixed(2)}` : ""}
          </p>
        )}
      </div>
      <ol className="mt-4 divide-y divide-cream/10 rounded-3xl border border-cream/15">
        {board.ranked.map((r, i) => {
          const place = r.place ?? i + 1;
          const name = r.displayName ?? r.pseudonym ?? `${r.wallet.slice(0, 4)}…${r.wallet.slice(-4)}`;
          const prize = r.prizeUsdc ?? 0;
          const paid = Boolean(r.paid && prize > 0);
          return (
            <li key={r.wallet} className="flex items-start gap-3 px-4 py-3.5">
              <span className="mt-0.5 w-8 shrink-0 font-mono text-sm text-cream/40">{place}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl(r.pseudonym ?? r.wallet, 64)}
                alt=""
                width={36}
                height={36}
                className="mt-0.5 size-9 shrink-0 rounded-full border border-cream/10 bg-ink"
              />
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${paid ? "text-teal" : "text-cream/85"}`}>
                  {r.pseudonym ? (
                    <Link href={`/u/${r.pseudonym}`} className="hover:underline">
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-cream/45">
                  {placeLabel(place, t)}
                  {paid ? (
                    <span className="text-teal">
                      {" · "}
                      {prize.toFixed(2)} USDC
                    </span>
                  ) : place <= board.nWinners ? (
                    <span className="text-cream/35"> · —</span>
                  ) : null}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[11px] text-cream/40">
        {t.boardSource}: {board.source} · {t.boardPrizeNote}
      </p>
    </section>
  );
}

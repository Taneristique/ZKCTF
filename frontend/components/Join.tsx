"use client";

import Link from "next/link";
import { useLang } from "@/lib/lang";
import { Membership } from "@/components/Membership";

/** Join: Saturday USDC race + Academy membership (both paid in USDC on-chain). */
export function Join() {
  const { t } = useLang();

  return (
    <section id="join" className="scroll-mt-20">
      <p className="text-xs uppercase tracking-[0.2em] text-teal">{t.liveBadge}</p>
      <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">{t.joinTitle}</h2>
      <p className="mt-2 max-w-xl text-sm text-cream/65">{t.joinLead}</p>

      <article className="mt-8 max-w-xl rounded-3xl border border-teal/40 bg-teal/[0.07] p-5 sm:p-7">
        <p className="text-4xl font-semibold">
          5 USDC<span className="text-base font-normal text-cream/45">{t.perWeek}</span>
        </p>
        <p className="mt-3 text-sm leading-6 text-cream/65">{t.ctfWhen}</p>
        <Link
          href="/play"
          className="mt-6 inline-flex min-h-12 items-center rounded-2xl border border-teal/50 bg-teal/10 px-6 text-sm text-teal hover:bg-teal/20"
        >
          {t.raceLive}
        </Link>
      </article>

      <h3 id="membership" className="mt-14 scroll-mt-20 text-2xl font-semibold sm:text-3xl">
        {t.membershipTitle}
      </h3>
      <p className="mt-2 max-w-xl text-sm text-cream/65">{t.membershipLead}</p>
      <p className="mt-2 max-w-xl text-sm text-cream/65">
        <Link href="/learn" className="text-teal underline">
          {t.academyTitle}
        </Link>
        {" — "}
        {t.academyLead}
      </p>
      <div className="mt-8">
        <Membership />
      </div>
    </section>
  );
}

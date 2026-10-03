"use client";

import { useLang } from "@/lib/lang";
import { Join } from "@/components/Join";
import { Countdown } from "@/components/Countdown";

export default function HomePage() {
  const { t } = useLang();

  return (
    <div className="flex flex-col gap-16 sm:gap-24">
      <section className="flex flex-col gap-6 pt-4 sm:pt-10">
        <p className="text-xs uppercase tracking-[0.25em] text-teal">{t.liveBadge}</p>
        <h1 className="max-w-xl text-3xl font-semibold leading-tight sm:text-5xl">{t.pitch}</h1>
        <p className="max-w-lg text-sm leading-6 text-cream/60 sm:text-base">{t.pitchLead}</p>
        <p className="max-w-lg text-sm leading-6 text-teal/90">{t.devnetLive}</p>
        <Countdown />
        <a
          href="#join"
          className="inline-flex min-h-12 w-fit items-center rounded-full bg-cream px-6 text-sm font-medium text-ink"
        >
          {t.join}
        </a>
      </section>
      <Join />
    </div>
  );
}

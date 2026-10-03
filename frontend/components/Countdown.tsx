"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/lang";
import { ctfWindow, formatRemain } from "@/lib/ctf";

export function Countdown({ compact = false }: { compact?: boolean }) {
  const { t } = useLang();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (now == null) {
    if (compact) {
      return <p className="hidden font-mono text-[11px] text-cream/50 lg:block">{t.ctfNext} —</p>;
    }
    return (
      <div className="rounded-[1.6rem] border border-cream/12 bg-cream/[0.03] px-5 py-4 sm:px-6">
        <p className="text-xs uppercase tracking-[0.18em] text-teal">{t.ctfNext}</p>
        <p className="mt-2 font-mono text-2xl tracking-tight sm:text-3xl">—</p>
        <p className="mt-2 text-sm text-cream/50">{t.ctfWhen}</p>
      </div>
    );
  }

  const w = ctfWindow(now);
  const remain = formatRemain(w.target - now);

  if (compact) {
    return (
      <p className="hidden font-mono text-[11px] text-cream/50 lg:block">
        {w.live ? t.ctfEnds : t.ctfNext} {remain}
      </p>
    );
  }

  return (
    <div className="rounded-[1.6rem] border border-cream/12 bg-cream/[0.03] px-5 py-4 sm:px-6">
      <p className="text-xs uppercase tracking-[0.18em] text-teal">{w.live ? t.ctfLive : t.ctfNext}</p>
      <p className="mt-2 font-mono text-2xl tracking-tight sm:text-3xl">{remain}</p>
      <p className="mt-2 text-sm text-cream/50">{t.ctfWhen}</p>
    </div>
  );
}

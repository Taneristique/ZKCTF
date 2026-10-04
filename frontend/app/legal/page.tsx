"use client";

import { useLang } from "@/lib/lang";
import { GITHUB_URL } from "@/components/Footer";

export default function LegalPage() {
  const { t } = useLang();

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs uppercase tracking-[0.2em] text-teal">{t.legal}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t.legalTitle}</h1>
      <p className="mt-4 text-sm leading-6 text-cream/55">{t.legalLead}</p>

      <section className="mt-12">
        <h2 className="text-lg font-medium">{t.privacyTitle}</h2>
        <p className="mt-3 text-[15px] leading-7 text-cream/65">{t.privacyBody}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">{t.escrowTitle}</h2>
        <p className="mt-3 text-[15px] leading-7 text-cream/65">{t.escrowBody}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">{t.foundersTitle}</h2>
        <p className="mt-3 text-[15px] leading-7 text-cream/65">{t.foundersBody}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">{t.loyaltyLegalTitle}</h2>
        <p className="mt-3 text-[15px] leading-7 text-cream/65">{t.loyaltyLegalBody}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">{t.contactTitle}</h2>
        <p className="mt-3 text-[15px] leading-7 text-cream/65">
          {t.contactBody}{" "}
          <a className="text-teal underline" href={GITHUB_URL} target="_blank" rel="noreferrer">
            github.com/Taneristique
          </a>
        </p>
      </section>
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LANGS, useLang } from "@/lib/lang";
import { useTheme } from "@/lib/theme";
import { Countdown } from "@/components/Countdown";

const empty = () => () => {};
const client = () => true;
const server = () => false;

export function Header() {
  const { lang, setLang, t } = useLang();
  const { theme, toggle } = useTheme();
  const ready = useSyncExternalStore(empty, client, server);
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/play", label: t.play },
    { href: "/learn", label: t.learn },
    { href: "/account", label: t.account },
    { href: "/#join", label: t.join },
    { href: "/docs", label: t.docs },
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-cream/10 bg-ink/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center px-3 sm:h-20 sm:px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 sm:gap-3" onClick={() => setOpen(false)}>
          <span className="relative size-12 overflow-hidden rounded-full bg-[#0a0c10] sm:size-16">
            <Image
              src="/logo.png"
              alt="ZKCTF"
              width={128}
              height={128}
              className="absolute inset-0 size-full scale-[1.9] object-cover"
              priority
            />
          </span>
          <span className="text-sm font-medium tracking-wide sm:text-base">ZKCTF</span>
        </Link>

        <nav className="ml-6 hidden items-center gap-5 text-sm text-cream/70 md:ml-10 md:flex lg:ml-14 lg:gap-7">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-cream">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden rounded-full border border-cream/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cream/45 sm:inline">
            {t.network}
          </span>
          <Countdown compact />
          <div className="hidden items-center gap-1 sm:flex" role="group" aria-label={t.language}>
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                lang={l.code}
                title={l.label}
                aria-label={l.label}
                aria-pressed={lang === l.code}
                onClick={() => setLang(l.code)}
                className={`rounded-full px-2 py-1 text-[11px] uppercase ${
                  lang === l.code ? "bg-cream text-ink" : "text-cream/50 hover:text-cream"
                }`}
              >
                {l.code}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={toggle}
            className="flex size-10 items-center justify-center rounded-full border border-cream/15 text-cream/70 hover:text-cream"
            aria-label={theme === "light" ? t.themeDark : t.themeLight}
            title={theme === "light" ? t.themeDark : t.themeLight}
          >
            {theme === "light" ? (
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 6.5 6.5 0 0 0 21 14.5Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="12" cy="12" r="3.5" />
                <path d="M12 3v1.5M12 19.5V21M4.9 4.9l1.1 1.1M18 18l1.1 1.1M3 12h1.5M19.5 12H21M4.9 19.1 6 18M18 6l1.1-1.1" />
              </svg>
            )}
          </button>
          <div className="zk-wallet shrink-0">
            {ready ? (
              <WalletMultiButton />
            ) : (
              <span className="inline-flex h-9 items-center whitespace-nowrap rounded-full bg-cream px-3 text-xs font-semibold text-ink md:h-10 md:px-4">
                {t.connectBtn}
              </span>
            )}
          </div>
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-full border border-cream/15 md:hidden"
            aria-expanded={open}
            aria-label={open ? t.menuClose : t.menuOpen}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="flex w-4 flex-col gap-1">
              <span className={`h-px bg-cream transition ${open ? "translate-y-1.5 rotate-45" : ""}`} />
              <span className={`h-px bg-cream transition ${open ? "opacity-0" : ""}`} />
              <span className={`h-px bg-cream transition ${open ? "-translate-y-1.5 -rotate-45" : ""}`} />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-cream/10 px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1 text-base">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="min-h-12 rounded-2xl px-3 py-3 text-cream/80 hover:bg-cream/5 hover:text-cream"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex gap-2 px-1" role="group" aria-label={t.language}>
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                lang={l.code}
                aria-pressed={lang === l.code}
                onClick={() => setLang(l.code)}
                className={`min-h-10 flex-1 rounded-full text-xs ${
                  lang === l.code ? "bg-cream text-ink" : "border border-cream/15 text-cream/60"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

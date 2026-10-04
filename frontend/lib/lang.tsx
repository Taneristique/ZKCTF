"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { en, type Dict } from "./i18n/en";

export const LANGS = [
  { code: "en", label: "English" },
  { code: "tr", label: "Türkçe" },
  { code: "es", label: "Español" },
] as const;

export type Lang = (typeof LANGS)[number]["code"];

const KEY = "zkctf.lang";

/** English ships in the main bundle; other catalogs load on first use. */
const catalogs: Record<Lang, () => Promise<Dict>> = {
  en: async () => en,
  tr: () => import("./i18n/tr").then((m) => m.tr),
  es: () => import("./i18n/es").then((m) => m.es),
};

const isLang = (v: unknown): v is Lang => LANGS.some((l) => l.code === v);

/** Saved choice, else the first supported browser language, else English. */
function preferredLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* storage blocked */
  }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.slice(0, 2).toLowerCase();
    if (isLang(base)) return base;
  }
  return "en";
}

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: Dict }>({
  lang: "en",
  setLang: () => {},
  t: en,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ lang: Lang; t: Dict }>({ lang: "en", t: en });
  const wanted = useRef<Lang>("en");

  const show = useCallback((next: Lang) => {
    wanted.current = next;
    void catalogs[next]()
      .catch(() => en)
      .then((dict) => {
        if (wanted.current !== next) return;
        document.documentElement.lang = next;
        setState({ lang: next, t: { ...en, ...dict } });
      });
  }, []);

  useEffect(() => {
    show(preferredLang());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && isLang(e.newValue)) show(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [show]);

  const setLang = useCallback(
    (next: Lang) => {
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* still switch for this session */
      }
      show(next);
    },
    [show],
  );

  return <Ctx.Provider value={{ ...state, setLang }}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}

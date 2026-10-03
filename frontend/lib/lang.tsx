"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { copy, type Lang } from "./copy";

type Dict = (typeof copy)[Lang];

const Ctx = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
}>({ lang: "en", setLang: () => {}, t: copy.en });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  return (
    <Ctx.Provider value={{ lang, setLang, t: copy[lang] }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLang() {
  return useContext(Ctx);
}

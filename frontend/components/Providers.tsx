"use client";

import { type ReactNode } from "react";
import { LangProvider } from "@/lib/lang";
import { ThemeProvider } from "@/lib/theme";
import { Wallet } from "./Wallet";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LangProvider>
        <Wallet>{children}</Wallet>
      </LangProvider>
    </ThemeProvider>
  );
}

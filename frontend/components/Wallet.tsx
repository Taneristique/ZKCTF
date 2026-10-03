"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl } from "@solana/web3.js";

const NETWORK = WalletAdapterNetwork.Devnet;

/** Never silently fall through to mainnet. */
function resolveEndpoint() {
  const env = process.env.NEXT_PUBLIC_SOLANA_RPC?.trim() ?? "";
  if (
    env &&
    (env.includes("devnet") || env.includes("127.0.0.1") || env.includes("localhost"))
  ) {
    return env;
  }
  return clusterApiUrl(NETWORK);
}

export function Wallet({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => resolveEndpoint(), []);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const wallets = useMemo(
    () =>
      mounted
        ? [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network: NETWORK })]
        : [],
    [mounted],
  );

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect={false} localStorageKey="zkctf-wallet">
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

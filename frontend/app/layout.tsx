import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist } from "next/font/google";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Providers } from "@/components/Providers";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0C10" },
  ],
};

export const metadata: Metadata = {
  title: "ZKCTF",
  description:
    "Affordable cybersecurity education built on reproduced real hacks, plus a weekly on-chain CTF on Solana: 5 USDC entry, Groth16 proof-of-solve, the 10 fastest finishers share 80% of the pot.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: "/logo.png",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const light = jar.get("zkctf-theme")?.value === "light";

  return (
    <html
      lang="en"
      className={`${geist.variable} h-full antialiased${light ? " light" : ""}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-12">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}

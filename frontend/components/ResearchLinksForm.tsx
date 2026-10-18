"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getJson, postJson } from "@/lib/api";
import { walletAuth } from "@/lib/walletAuth";
import { useLang } from "@/lib/lang";

type ResearchRow = { id: string; label: string; handle: string; href: string };

const PLATFORM_IDS = ["sherlock", "code4rena", "cantina", "codehawks", "immunefi", "hackenproof"] as const;

export function ResearchLinksForm() {
  const { t } = useLang();
  const { publicKey, signMessage, connected } = useWallet();
  const [links, setLinks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    if (!publicKey) {
      setLinks({});
      setHasProfile(false);
      return;
    }
    void getJson<{ profile: { pseudonym?: string } | null; research?: ResearchRow[] }>(
      `/profile/${publicKey.toBase58()}`,
    )
      .then((r) => {
        setHasProfile(Boolean(r.profile?.pseudonym));
        const next: Record<string, string> = {};
        for (const row of r.research ?? []) next[row.id] = row.handle;
        setLinks(next);
      })
      .catch(() => {
        setHasProfile(false);
        setLinks({});
      });
  }, [publicKey]);

  if (!connected || !publicKey) return null;

  async function save() {
    if (!publicKey || !signMessage) return;
    setBusy(true);
    setNote(null);
    try {
      const headers = await walletAuth(publicKey.toBase58(), signMessage);
      const out = await postJson<{ ok: boolean; error?: string; research?: ResearchRow[] }>(
        "/profile/research",
        { links },
        headers,
      );
      if (!out.ok) throw new Error(out.error ?? "Failed");
      const next: Record<string, string> = {};
      for (const row of out.research ?? []) next[row.id] = row.handle;
      setLinks(next);
      setNote(t.researchSaved);
    } catch (e) {
      setNote(e instanceof Error ? e.message : t.rejected);
    } finally {
      setBusy(false);
    }
  }

  const labels: Record<string, string> = {
    sherlock: "Sherlock",
    code4rena: "Code4rena",
    cantina: "Cantina",
    codehawks: "CodeHawks",
    immunefi: "Immunefi",
    hackenproof: "HackenProof",
  };

  return (
    <section className="mt-8 rounded-3xl border border-cream/15 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-teal">{t.researchTitle}</p>
      <p className="mt-2 text-sm leading-6 text-cream/65">{t.researchLead}</p>
      {!hasProfile ? (
        <p className="mt-3 text-xs text-cream/45">{t.researchNeedPseudo}</p>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {PLATFORM_IDS.map((id) => (
              <label key={id} className="text-xs text-cream/45">
                {labels[id]}
                <input
                  value={links[id] ?? ""}
                  onChange={(e) => setLinks({ ...links, [id]: e.target.value })}
                  placeholder={id === "sherlock" ? "dtheo" : "handle"}
                  className="mt-1 min-h-11 w-full rounded-2xl border border-cream/15 bg-ink px-3 font-mono text-sm"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="mt-4 min-h-11 rounded-2xl bg-cream px-5 text-sm font-medium text-ink disabled:opacity-40"
          >
            {t.researchSave}
          </button>
        </>
      )}
      {note && <p className="mt-3 text-xs text-cream/55">{note}</p>}
    </section>
  );
}

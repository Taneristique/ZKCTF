"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { getJson, postJson } from "@/lib/api";
import { walletAuth } from "@/lib/walletAuth";
import { useLang } from "@/lib/lang";
import { avatarUrl } from "@/lib/avatar";

type Profile = {
  pseudonym: string;
  createdAt: number;
  updatedAt: number;
  renameCount: number;
  renamesLeft: number;
  canRename: boolean;
};

type WeekNft = {
  round: number;
  rank: number;
  mint: string;
  pseudonym?: string;
};

export function ProfileCard() {
  const { t } = useLang();
  const { publicKey, connected, signMessage } = useWallet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [weekNfts, setWeekNfts] = useState<WeekNft[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!publicKey) {
      setProfile(null);
      setWeekNfts([]);
      return;
    }
    const w = publicKey.toBase58();
    void getJson<{ profile: Profile | null; weekNfts?: WeekNft[] }>(`/profile/${w}`)
      .then((r) => {
        setProfile(r.profile);
        setName(r.profile?.pseudonym ?? "");
        setWeekNfts(r.weekNfts ?? []);
      })
      .catch(() => {
        setProfile(null);
        setWeekNfts([]);
      });
  }, [publicKey]);

  async function save() {
    if (!publicKey || !signMessage) return;
    setBusy(true);
    setNote(null);
    try {
      const headers = await walletAuth(publicKey.toBase58(), signMessage);
      const out = await postJson<{ ok: boolean; profile?: Profile; error?: string }>(
        "/profile",
        { wallet: publicKey.toBase58(), pseudonym: name },
        headers,
      );
      if (!out.ok || !out.profile) throw new Error(out.error ?? "Failed");
      setProfile(out.profile);
      setNote(t.profileSaved);
    } catch (e) {
      setNote(e instanceof Error ? e.message : t.rejected);
    } finally {
      setBusy(false);
    }
  }

  if (!connected) {
    return (
      <section className="mt-8 rounded-3xl border border-cream/15 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-teal">{t.profileTitle}</p>
        <p className="mt-2 text-sm text-cream/55">{t.connectFirst}</p>
      </section>
    );
  }

  const locked = Boolean(profile && !profile.canRename);

  const seed = profile?.pseudonym || name.trim() || publicKey.toBase58();

  return (
    <section className="mt-8 rounded-3xl border border-cream/15 p-5">
      <div className="flex items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl(seed, 128)}
          alt=""
          width={56}
          height={56}
          className="size-14 shrink-0 rounded-full border border-cream/15 bg-ink"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.2em] text-teal">{t.profileTitle}</p>
          <p className="mt-2 text-sm leading-6 text-cream/65">{t.profileLead}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="0xWarden"
          maxLength={20}
          disabled={locked}
          className="min-h-12 flex-1 rounded-2xl border border-cream/15 bg-ink px-4 font-mono text-sm disabled:opacity-50"
        />
        {!locked && (
          <button
            type="button"
            disabled={busy || name.trim().length < 3}
            onClick={() => void save()}
            className="min-h-12 rounded-2xl bg-cream px-5 text-sm font-medium text-ink disabled:opacity-40"
          >
            {profile ? t.profileRename : t.profileCreate}
          </button>
        )}
      </div>
      {profile && (
        <p className="mt-2 font-mono text-xs text-cream/45">
          {t.profileAs} <span className="text-teal">{profile.pseudonym}</span>
          {profile.canRename ? ` · ${t.profileOneRename}` : ` · ${t.profileLocked}`}
          {" · "}
          <Link href={`/u/${profile.pseudonym}`} className="text-teal underline">
            {t.publicProfileLink}
          </Link>
        </p>
      )}
      {weekNfts.length > 0 && (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.2em] text-cream/45">{t.weekNftTitle}</p>
          <ul className="mt-2 space-y-1 text-sm text-cream/75">
            {weekNfts.map((n) => (
              <li key={`${n.round}-${n.mint}`} className="font-mono text-xs">
                #{n.rank} · {new Date(n.round * 1000).toISOString().slice(0, 10)} · {n.mint.slice(0, 8)}…
              </li>
            ))}
          </ul>
        </div>
      )}
      {note && <p className="mt-3 text-xs text-cream/55">{note}</p>}
    </section>
  );
}

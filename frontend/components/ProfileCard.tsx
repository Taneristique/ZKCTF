"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { deleteJson, getJson, postJson } from "@/lib/api";
import { walletAuth } from "@/lib/walletAuth";
import { useLang } from "@/lib/lang";
import { AVATAR_EMOJIS, avatarEmoji } from "@/lib/avatar";
import { Avatar } from "@/components/Avatar";

const MAX_UPLOAD = 300_000;

type AvatarKind = "emoji" | "photo";

type Profile = {
  pseudonym: string;
  emoji?: string | null;
  imageUrl?: string | null;
  avatarKind?: AvatarKind;
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read file."));
    r.readAsDataURL(file);
  });
}

export function ProfileCard() {
  const { t } = useLang();
  const { publicKey, connected, signMessage } = useWallet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [weekNfts, setWeekNfts] = useState<WeekNft[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<AvatarKind>("emoji");
  const [emoji, setEmojiLocal] = useState(() => avatarEmoji("zkctf"));
  const [emojiTouched, setEmojiTouched] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
        if (r.profile) {
          setKind(r.profile.avatarKind === "photo" ? "photo" : "emoji");
          if (r.profile.emoji) {
            setEmojiLocal(r.profile.emoji);
            setEmojiTouched(true);
          }
        }
      })
      .catch(() => {
        setProfile(null);
        setWeekNfts([]);
      });
  }, [publicKey]);

  // Suggest default emoji from typed name until the user picks one.
  useEffect(() => {
    if (profile || emojiTouched) return;
    const seed = name.trim() || publicKey?.toBase58() || "zkctf";
    setEmojiLocal(avatarEmoji(seed));
  }, [name, profile, emojiTouched, publicKey]);

  useEffect(() => {
    return () => {
      if (pendingPreview?.startsWith("blob:")) URL.revokeObjectURL(pendingPreview);
    };
  }, [pendingPreview]);

  async function uploadPhoto(file: File, headers: Record<string, string>) {
    const dataUrl = await fileToDataUrl(file);
    const out = await postJson<{ ok: boolean; profile?: Profile; error?: string }>(
      "/profile/avatar",
      { image: dataUrl },
      headers,
    );
    if (!out.ok || !out.profile) throw new Error(out.error ?? "Failed");
    return out.profile;
  }

  async function persistEmoji(nextEmoji: string, clearPhoto: boolean) {
    if (!publicKey || !signMessage) return null;
    const headers = await walletAuth(publicKey.toBase58(), signMessage);
    const out = await postJson<{ ok: boolean; profile?: Profile; error?: string }>(
      "/profile/emoji",
      { emoji: nextEmoji, clearPhoto },
      headers,
    );
    if (!out.ok || !out.profile) throw new Error(out.error ?? "Failed");
    return out.profile;
  }

  async function save() {
    if (!publicKey || !signMessage) return;
    if (kind === "photo" && !profile?.imageUrl && !pendingFile) {
      setNote(t.profilePhotoNeedFile);
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const headers = await walletAuth(publicKey.toBase58(), signMessage);
      const out = await postJson<{ ok: boolean; profile?: Profile; error?: string }>(
        "/profile",
        {
          wallet: publicKey.toBase58(),
          pseudonym: name,
          emoji: kind === "emoji" ? emoji : undefined,
        },
        headers,
      );
      if (!out.ok || !out.profile) throw new Error(out.error ?? "Failed");
      let next = out.profile;
      if (kind === "photo" && pendingFile) {
        next = await uploadPhoto(pendingFile, headers);
        if (pendingPreview?.startsWith("blob:")) URL.revokeObjectURL(pendingPreview);
        setPendingFile(null);
        setPendingPreview(null);
      }
      setProfile(next);
      setKind(next.avatarKind === "photo" ? "photo" : "emoji");
      if (next.emoji) {
        setEmojiLocal(next.emoji);
        setEmojiTouched(true);
      }
      setNote(t.profileSaved);
    } catch (e) {
      setNote(e instanceof Error ? e.message : t.rejected);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function pickEmoji(nextEmoji: string) {
    setEmojiLocal(nextEmoji);
    setEmojiTouched(true);
    setKind("emoji");
    if (pendingPreview?.startsWith("blob:")) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview(null);

    // Before profile exists: local pick only; saved with Create.
    if (!profile || !publicKey || !signMessage) return;

    setBusy(true);
    setNote(null);
    try {
      const next = await persistEmoji(nextEmoji, Boolean(profile.imageUrl));
      if (!next) return;
      setProfile(next);
      setNote(t.profileEmojiSaved);
    } catch (e) {
      setNote(e instanceof Error ? e.message : t.rejected);
    } finally {
      setBusy(false);
    }
  }

  async function chooseEmojiMode() {
    setKind("emoji");
    if (pendingPreview?.startsWith("blob:")) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview(null);

    // Already on emoji (no photo) — just show picker.
    if (!profile?.imageUrl || !publicKey || !signMessage) return;

    setBusy(true);
    setNote(null);
    try {
      const next = await persistEmoji(emoji, true);
      if (!next) return;
      setProfile(next);
      setNote(t.profilePhotoRemoved);
    } catch (e) {
      setNote(e instanceof Error ? e.message : t.rejected);
    } finally {
      setBusy(false);
    }
  }

  function choosePhotoMode() {
    setKind("photo");
    // New photo or replace: open picker. Existing photo: just preview it.
    if (!profile?.imageUrl && !pendingFile) {
      fileRef.current?.click();
    }
  }

  async function onPickPhoto(file: File | null) {
    if (!file) return;
    if (file.size > MAX_UPLOAD) {
      setNote(t.profilePhotoTooBig);
      return;
    }
    if (!/image\/(jpeg|jpg|png|webp)/i.test(file.type)) {
      setNote(t.profilePhotoType);
      return;
    }

    if (!profile) {
      if (pendingPreview?.startsWith("blob:")) URL.revokeObjectURL(pendingPreview);
      setKind("photo");
      setPendingFile(file);
      setPendingPreview(URL.createObjectURL(file));
      setNote(null);
      return;
    }

    if (!publicKey || !signMessage) return;
    setBusy(true);
    setNote(null);
    try {
      const headers = await walletAuth(publicKey.toBase58(), signMessage);
      const next = await uploadPhoto(file, headers);
      setProfile(next);
      setKind("photo");
      if (pendingPreview?.startsWith("blob:")) URL.revokeObjectURL(pendingPreview);
      setPendingFile(null);
      setPendingPreview(null);
      setNote(t.profilePhotoSaved);
    } catch (e) {
      setNote(e instanceof Error ? e.message : t.rejected);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto() {
    if (!publicKey || !signMessage) return;
    if (!profile?.imageUrl && !pendingFile) return;

    if (pendingFile) {
      if (pendingPreview?.startsWith("blob:")) URL.revokeObjectURL(pendingPreview);
      setPendingFile(null);
      setPendingPreview(null);
      setKind("emoji");
      return;
    }

    setBusy(true);
    setNote(null);
    try {
      const headers = await walletAuth(publicKey.toBase58(), signMessage);
      const out = await deleteJson<{ ok: boolean; profile?: Profile; error?: string }>(
        "/profile/avatar",
        headers,
      );
      if (!out.ok) throw new Error(out.error ?? "Failed");
      setProfile(out.profile ?? { ...profile!, imageUrl: null, avatarKind: "emoji" });
      setKind("emoji");
      setNote(t.profilePhotoRemoved);
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
  const seed = profile?.pseudonym || name.trim() || publicKey?.toBase58() || "zkctf";
  const previewSrc = kind === "photo" ? pendingPreview || profile?.imageUrl || null : null;

  return (
    <section className="mt-8 rounded-3xl border border-cream/15 p-5">
      <div className="flex items-start gap-4">
        <Avatar seed={seed} src={previewSrc} emoji={emoji} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.2em] text-teal">{t.profileTitle}</p>
          <p className="mt-2 text-sm leading-6 text-cream/65">{t.profileLead}</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs uppercase tracking-[0.2em] text-cream/45">{t.profileAvatarTitle}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void chooseEmojiMode()}
            className={`min-h-10 rounded-2xl px-4 text-sm ${
              kind === "emoji" ? "bg-cream text-ink" : "border border-cream/20 text-cream/80"
            } disabled:opacity-40`}
          >
            {t.profileAvatarEmoji}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => choosePhotoMode()}
            className={`min-h-10 rounded-2xl px-4 text-sm ${
              kind === "photo" ? "bg-cream text-ink" : "border border-cream/20 text-cream/80"
            } disabled:opacity-40`}
          >
            {t.profileAvatarPhoto}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => void onPickPhoto(e.target.files?.[0] ?? null)}
          />
        </div>
        <p className="mt-2 text-[11px] text-cream/40">
          {kind === "emoji" ? t.profileEmojiHint : t.profilePhotoHint}
        </p>
      </div>

      {kind === "emoji" && (
        <div className="mt-3 grid max-h-44 grid-cols-8 gap-1 overflow-y-auto sm:grid-cols-10">
          {AVATAR_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              disabled={busy}
              onClick={() => void pickEmoji(e)}
              className={`flex size-9 items-center justify-center rounded-xl text-xl ${
                emoji === e ? "bg-teal/30 ring-1 ring-teal" : "hover:bg-cream/10"
              } disabled:opacity-40`}
              title={e}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {kind === "photo" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="min-h-10 rounded-2xl border border-cream/20 px-4 text-sm text-cream/85 disabled:opacity-40"
          >
            {pendingFile || profile?.imageUrl ? t.profilePhotoChange : t.profilePhotoUpload}
          </button>
          {(profile?.imageUrl || pendingFile) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void removePhoto()}
              className="min-h-10 rounded-2xl px-3 text-sm text-cream/50 underline disabled:opacity-40"
            >
              {t.profilePhotoRemove}
            </button>
          )}
        </div>
      )}

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

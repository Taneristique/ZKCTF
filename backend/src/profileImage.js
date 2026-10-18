/**
 * Personal profile photos on the Railway volume (not NFTs).
 * Hobby 5 GB volume easily holds many ~300 KB JPEGs; billed only for used space.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./dataDir.js";
import { dataPath, load, save } from "./store.js";

const DIR = join(DATA_DIR, "avatars");
const PROFILES = dataPath("profiles.json");
/** Hard cap keeps volume + egress tiny on Hobby. */
export const MAX_BYTES = 300_000;

function ensureDir() {
  mkdirSync(DIR, { recursive: true });
}

function detect(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { ext: "png", mime: "image/png" };
  }
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

function pathFor(wallet, ext) {
  return join(DIR, `${wallet}.${ext}`);
}

function parseDataUrl(raw) {
  const s = String(raw ?? "");
  const m = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i.exec(s.replace(/\s/g, ""));
  if (m) {
    return Buffer.from(m[2], "base64");
  }
  // Raw base64 fallback
  if (/^[A-Za-z0-9+/=\s]+$/.test(s) && s.length > 64) {
    return Buffer.from(s.replace(/\s/g, ""), "base64");
  }
  return null;
}

/** Path relative to the API root (frontend prepends NEXT_PUBLIC_API / `/zk-api`). */
export function imageUrlFor(wallet, row) {
  if (!row?.imageExt) return null;
  const v = row.imageAt ?? 0;
  return `/avatars/${wallet}?v=${v}`;
}

export function saveProfileImage(wallet, dataUrl) {
  const all = load(PROFILES);
  all.byWallet ??= {};
  const prev = all.byWallet[wallet];
  if (!prev?.pseudonym) return { ok: false, error: "Create a pseudonym before uploading a photo." };

  const buf = parseDataUrl(dataUrl);
  if (!buf || !buf.length) return { ok: false, error: "Invalid image payload." };
  if (buf.length > MAX_BYTES) {
    return { ok: false, error: `Image too large (max ${Math.floor(MAX_BYTES / 1024)} KB).` };
  }
  const kind = detect(buf);
  if (!kind) return { ok: false, error: "Use JPEG, PNG, or WebP." };

  ensureDir();
  // Remove previous extension if changed.
  if (prev.imageExt && prev.imageExt !== kind.ext) {
    const old = pathFor(wallet, prev.imageExt);
    if (existsSync(old)) try { unlinkSync(old); } catch { /* ignore */ }
  }
  const dest = pathFor(wallet, kind.ext);
  const tmp = `${dest}.tmp`;
  writeFileSync(tmp, buf);
  renameSync(tmp, dest);

  const now = Date.now();
  all.byWallet[wallet] = { ...prev, imageExt: kind.ext, imageAt: now, updatedAt: now };
  save(PROFILES, all);
  return {
    ok: true,
    imageUrl: imageUrlFor(wallet, all.byWallet[wallet]),
    bytes: buf.length,
  };
}

export function removeProfileImage(wallet) {
  const all = load(PROFILES);
  const prev = all.byWallet?.[wallet];
  if (!prev) return { ok: false, error: "No profile." };
  if (prev.imageExt) {
    const p = pathFor(wallet, prev.imageExt);
    if (existsSync(p)) try { unlinkSync(p); } catch { /* ignore */ }
  }
  const { imageExt: _e, imageAt: _a, ...rest } = prev;
  all.byWallet[wallet] = { ...rest, updatedAt: Date.now() };
  save(PROFILES, all);
  return { ok: true, imageUrl: null };
}

export function readProfileImage(wallet) {
  const all = load(PROFILES);
  const row = all.byWallet?.[wallet];
  if (!row?.imageExt) return null;
  const p = pathFor(wallet, row.imageExt);
  if (!existsSync(p)) return null;
  const buf = readFileSync(p);
  const kind = detect(buf) ?? {
    ext: row.imageExt,
    mime: row.imageExt === "png" ? "image/png" : row.imageExt === "webp" ? "image/webp" : "image/jpeg",
  };
  return { buf, mime: kind.mime, at: row.imageAt ?? 0 };
}

/**
 * Pseudonym profiles: independent of CTF entry and Academy membership.
 * One wallet → one unique name. Create free; at most ONE rename for life, then locked.
 */
import { dataPath, load, save } from "./store.js";
import { imageUrlFor } from "./profileImage.js";
import { isAllowedEmoji, resolveEmoji } from "./avatarEmojis.js";

const PATH = dataPath("profiles.json");
const NAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const RESERVED = new Set([
  "admin",
  "zkctf",
  "null",
  "undefined",
  "system",
  "authority",
  "treasury",
  "account",
  "play",
  "learn",
  "docs",
  "legal",
  "u",
]);

function db() {
  const all = load(PATH);
  if (!all.byWallet) all.byWallet = {};
  if (!all.byName) all.byName = {};
  return all;
}

export function normalizeName(raw) {
  return String(raw ?? "").trim();
}

export function validateName(raw) {
  const name = normalizeName(raw);
  if (!NAME_RE.test(name)) {
    return { ok: false, error: "Use 3–20 characters: letters, numbers, underscore." };
  }
  if (RESERVED.has(name.toLowerCase())) {
    return { ok: false, error: "That name is reserved." };
  }
  return { ok: true, name };
}

function renameCountOf(row) {
  if (typeof row.renameCount === "number") return row.renameCount;
  // Legacy: 30-day cooldown rows — if name was ever changed, treat as already used the one rename.
  if (row.updatedAt && row.createdAt && row.updatedAt !== row.createdAt) return 1;
  return 0;
}

/** Fallback seed when no uploaded photo (emoji avatar). */
export function avatarSeed(pseudonymOrWallet) {
  return String(pseudonymOrWallet ?? "zkctf").trim() || "zkctf";
}

export function profileFor(wallet) {
  const row = db().byWallet[wallet];
  if (!row) return null;
  const renameCount = renameCountOf(row);
  const renamesLeft = Math.max(0, 1 - renameCount);
  const imageUrl = imageUrlFor(wallet, row);
  return {
    wallet,
    pseudonym: row.pseudonym,
    avatarSeed: avatarSeed(row.pseudonym),
    emoji: resolveEmoji(row),
    emojiCustom: Boolean(row.emoji && isAllowedEmoji(row.emoji)),
    imageUrl,
    avatarKind: imageUrl ? "photo" : "emoji",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    renameCount,
    renamesLeft,
    canRename: renamesLeft > 0,
  };
}

export function nameAvailable(raw, exceptWallet = null) {
  const v = validateName(raw);
  if (!v.ok) return v;
  const owner = db().byName[v.name.toLowerCase()];
  if (owner && owner !== exceptWallet) return { ok: false, error: "That name is taken.", name: v.name };
  return { ok: true, name: v.name };
}

export function walletForName(raw) {
  const name = normalizeName(raw);
  if (!name) return null;
  return db().byName[name.toLowerCase()] ?? null;
}

export function setProfile(wallet, raw, opts = {}) {
  const check = nameAvailable(raw, wallet);
  if (!check.ok) return check;
  const all = db();
  const prev = all.byWallet[wallet];
  const now = Date.now();

  let emoji = prev?.emoji;
  if (opts.emoji != null && opts.emoji !== "") {
    if (!isAllowedEmoji(opts.emoji)) {
      return { ok: false, error: "Pick an emoji from the list." };
    }
    emoji = opts.emoji;
  }

  if (prev) {
    const same = prev.pseudonym.toLowerCase() === check.name.toLowerCase();
    if (same) {
      if (opts.emoji != null && opts.emoji !== "" && emoji !== prev.emoji) {
        all.byWallet[wallet] = { ...prev, emoji, updatedAt: now };
        save(PATH, all);
      }
      return { ok: true, profile: profileFor(wallet) };
    }
    if (renameCountOf(prev) >= 1) {
      return {
        ok: false,
        error: "You already used your one rename. This pseudonym is locked.",
      };
    }
    delete all.byName[prev.pseudonym.toLowerCase()];
  }

  const row = {
    pseudonym: check.name,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    renameCount: prev ? renameCountOf(prev) + 1 : 0,
    ...(emoji ? { emoji } : {}),
    ...(prev?.imageExt ? { imageExt: prev.imageExt, imageAt: prev.imageAt } : {}),
  };
  all.byWallet[wallet] = row;
  all.byName[check.name.toLowerCase()] = wallet;
  save(PATH, all);
  return { ok: true, profile: profileFor(wallet) };
}

/** Set (or change) profile emoji anytime. Optionally drop uploaded photo. */
export function setEmoji(wallet, rawEmoji, { clearPhoto = false } = {}) {
  const all = db();
  const prev = all.byWallet?.[wallet];
  if (!prev?.pseudonym) return { ok: false, error: "Create a pseudonym first." };
  if (!isAllowedEmoji(rawEmoji)) return { ok: false, error: "Pick an emoji from the list." };

  const now = Date.now();
  const next = { ...prev, emoji: rawEmoji, updatedAt: now };
  if (clearPhoto && prev.imageExt) {
    delete next.imageExt;
    delete next.imageAt;
  }
  all.byWallet[wallet] = next;
  save(PATH, all);
  return { ok: true, profile: profileFor(wallet), clearedPhoto: Boolean(clearPhoto && prev.imageExt) };
}

/** Map wallet → pseudonym for leaderboard enrichment. */
export function namesFor(wallets) {
  const all = db().byWallet;
  const out = {};
  for (const w of wallets) {
    if (all[w]?.pseudonym) out[w] = all[w].pseudonym;
  }
  return out;
}

/** Map wallet → imageUrl for leaderboard / cards. */
export function imageUrlsFor(wallets) {
  const all = db().byWallet;
  const out = {};
  for (const w of wallets) {
    const url = imageUrlFor(w, all[w]);
    if (url) out[w] = url;
  }
  return out;
}

/** Map wallet → display emoji (custom or default). */
export function emojisFor(wallets) {
  const all = db().byWallet;
  const out = {};
  for (const w of wallets) {
    if (all[w]) out[w] = resolveEmoji(all[w]);
  }
  return out;
}

export function displayName(wallet) {
  return profileFor(wallet)?.pseudonym ?? `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

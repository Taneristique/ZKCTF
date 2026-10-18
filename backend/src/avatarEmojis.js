/** Allowlisted profile emojis (must match frontend/lib/avatar.ts). */
export const AVATAR_EMOJIS = [
  "🦊", "🐺", "🐯", "🦁", "🦄", "🐉", "🦅", "🦉", "🦈", "🐙",
  "🦋", "🐝", "🦕", "🦖", "🐊", "🦎", "🐢", "🐍", "🦇", "🦂",
  "⚡", "🔥", "❄️", "🌊", "🌙", "⭐", "☄️", "🪐", "🛰️", "🧿",
  "💎", "🔮", "🗝️", "⚔️", "🛡️", "🏹", "♟️", "🧩", "🎯", "🕹️",
  "🧬", "📡", "🔋", "💾", "🖥️", "🧪", "⚗️", "🔭", "🗿",
  "🎭", "🃏", "🎲", "🎪", "🎨", "🎹", "🥁", "🎷", "🎸", "🎺",
  "🌿", "🪴", "🌵", "🍀", "🌸", "🌺", "🌻", "🌼", "🌾", "🍃",
  "🐱", "🐶", "🐰", "🐼", "🐨", "🐸", "🐧", "🐦", "🐤", "🦩",
];

const SET = new Set(AVATAR_EMOJIS);

export function isAllowedEmoji(raw) {
  return SET.has(String(raw ?? ""));
}

function hashSeed(seed) {
  let h = 2166136261;
  const s = String(seed || "zkctf").trim() || "zkctf";
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic default when user has not picked an emoji. */
export function defaultEmoji(seed) {
  return AVATAR_EMOJIS[hashSeed(seed) % AVATAR_EMOJIS.length];
}

/** Stored pick, or hash default from pseudonym. */
export function resolveEmoji(row) {
  if (row?.emoji && isAllowedEmoji(row.emoji)) return row.emoji;
  return defaultEmoji(row?.pseudonym ?? "zkctf");
}

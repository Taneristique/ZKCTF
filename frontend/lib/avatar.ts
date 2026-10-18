/**
 * Profile emoji avatars — pickable from this list, or hashed default from seed.
 */

export const AVATAR_EMOJIS = [
  "🦊", "🐺", "🐯", "🦁", "🦄", "🐉", "🦅", "🦉", "🦈", "🐙",
  "🦋", "🐝", "🦕", "🦖", "🐊", "🦎", "🐢", "🐍", "🦇", "🦂",
  "⚡", "🔥", "❄️", "🌊", "🌙", "⭐", "☄️", "🪐", "🛰️", "🧿",
  "💎", "🔮", "🗝️", "⚔️", "🛡️", "🏹", "♟️", "🧩", "🎯", "🕹️",
  "🧬", "📡", "🔋", "💾", "🖥️", "🧪", "⚗️", "🔭", "🗿",
  "🎭", "🃏", "🎲", "🎪", "🎨", "🎹", "🥁", "🎷", "🎸", "🎺",
  "🌿", "🪴", "🌵", "🍀", "🌸", "🌺", "🌻", "🌼", "🌾", "🍃",
  "🐱", "🐶", "🐰", "🐼", "🐨", "🐸", "🐧", "🐦", "🐤", "🦩",
] as const;

export type AvatarEmoji = (typeof AVATAR_EMOJIS)[number];

function hashSeed(seed: string): number {
  let h = 2166136261;
  const s = (seed || "zkctf").trim() || "zkctf";
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function avatarEmoji(seed: string): string {
  return AVATAR_EMOJIS[hashSeed(seed) % AVATAR_EMOJIS.length]!;
}

export function isAvatarEmoji(raw: string): raw is AvatarEmoji {
  return (AVATAR_EMOJIS as readonly string[]).includes(raw);
}

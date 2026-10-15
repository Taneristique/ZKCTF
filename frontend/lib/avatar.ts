/**
 * Deterministic emoji avatar from pseudonym/wallet.
 * Same seed → same emoji forever; different users get different ones (hash spread).
 */

const EMOJIS = [
  "🦊", "🐺", "🐯", "🦁", "🦄", "🐉", "🦅", "🦉", "🦈", "🐙",
  "🦋", "🐝", "🦕", "🦖", "🐊", "🦎", "🐢", "🐍", "🦇", "🦂",
  "⚡", "🔥", "❄️", "🌊", "🌙", "⭐", "☄️", "🪐", "🛰️", "🧿",
  "💎", "🔮", "🗝️", "⚔️", "🛡️", "🏹", "♟️", "🧩", "🎯", "🕹️",
  "🧬", "🛰️", "📡", "🔋", "💾", "🖥️", "🧪", "⚗️", "🔭", "🗿",
  "🎭", "🃏", "🎲", "🎪", "🎨", "🎹", "🥁", "🎷", "🎸", "🎺",
  "🌿", "🪴", "🌵", "🍀", "🌸", "🌺", "🌻", "🌼", "🌾", "🍃",
  "🐱", "🐶", "🐰", "🐼", "🐨", "🐸", "🐧", "🐦", "🐤", "🦩",
] as const;

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
  return EMOJIS[hashSeed(seed) % EMOJIS.length]!;
}

/** @deprecated Prefer Avatar component / avatarEmoji — kept for any lingering img callers. */
export function avatarUrl(seed: string, _size = 128): string {
  const emoji = avatarEmoji(seed);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#0a0c10"/><stop offset="100%" stop-color="#0d3d3a"/>
  </linearGradient></defs>
  <circle cx="64" cy="64" r="64" fill="url(#g)"/>
  <text x="64" y="72" text-anchor="middle" font-size="56">${emoji}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

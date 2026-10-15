/**
 * Deterministic, brand-aligned avatar from pseudonym (or wallet).
 * Dicebear glass + fixed ink/teal palette (not multicolor random shapes).
 */
export function avatarUrl(seed: string, size = 128): string {
  const s = (seed || "zkctf").trim() || "zkctf";
  const q = new URLSearchParams({
    seed: s,
    size: String(size),
    radius: "50",
    backgroundColor: "0a0c10,0d3d3a,134e4a",
    backgroundType: "gradientLinear",
  });
  return `https://api.dicebear.com/9.x/glass/svg?${q.toString()}`;
}

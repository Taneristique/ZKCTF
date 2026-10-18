/**
 * External research profile handles (Sherlock Watson-style).
 * We only store handles and link out — we do not scrape or invent findings.
 * Ownership proof (bio challenge / OAuth) can be added later; until then links are unverified.
 */
export const RESEARCH_PLATFORMS = {
  sherlock: {
    id: "sherlock",
    label: "Sherlock",
    url: (h) => `https://audits.sherlock.xyz/watson/${encodeURIComponent(h)}`,
  },
  code4rena: {
    id: "code4rena",
    label: "Code4rena",
    url: (h) => `https://code4rena.com/@${encodeURIComponent(h)}`,
  },
  cantina: {
    id: "cantina",
    label: "Cantina",
    url: (h) => `https://cantina.xyz/u/${encodeURIComponent(h)}`,
  },
  // No stable public /handle URL — store handle for display; user can verify on-site later.
  codehawks: { id: "codehawks", label: "CodeHawks", url: null },
  immunefi: { id: "immunefi", label: "Immunefi", url: null },
  hackenproof: { id: "hackenproof", label: "HackenProof", url: null },
};

const HANDLE_RE = /^[A-Za-z0-9_.-]{2,40}$/;

export function normalizeHandle(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/^@/, "");
}

export function validateHandle(raw) {
  const h = normalizeHandle(raw);
  if (!h) return { ok: true, handle: "" }; // empty = clear
  if (!HANDLE_RE.test(h)) {
    return { ok: false, error: "Handle: 2–40 chars, letters, numbers, _ . -" };
  }
  return { ok: true, handle: h };
}

/** Sanitize a map of platform → handle. */
export function sanitizeResearch(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const id of Object.keys(RESEARCH_PLATFORMS)) {
    if (raw[id] == null || raw[id] === "") continue;
    const v = validateHandle(raw[id]);
    if (!v.ok) return { error: `${RESEARCH_PLATFORMS[id].label}: ${v.error}` };
    if (v.handle) out[id] = v.handle;
  }
  return { links: out };
}

/** Public view: [{ id, label, handle, href }]. */
export function publicResearch(links) {
  const src = links && typeof links === "object" ? links : {};
  const rows = [];
  for (const [id, meta] of Object.entries(RESEARCH_PLATFORMS)) {
    const handle = normalizeHandle(src[id]);
    if (!handle) continue;
    rows.push({
      id,
      label: meta.label,
      handle,
      href: typeof meta.url === "function" ? meta.url(handle) : null,
      verified: false,
    });
  }
  return rows;
}

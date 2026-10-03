/** Weekly race: Saturday 18:00 Istanbul = 15:00 UTC, 24 hours. */
export const CTF_UTC_HOUR = 15;
export const CTF_HOURS = 24;

export function ctfWindow(nowMs = Date.now()) {
  const now = new Date(nowMs);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), CTF_UTC_HOUR, 0, 0, 0));
  const daysSinceSat = (start.getUTCDay() + 1) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceSat);
  const end = new Date(start.getTime() + CTF_HOURS * 60 * 60 * 1000);
  if (nowMs < start.getTime()) {
    return { live: false, target: start.getTime(), start: start.getTime(), end: end.getTime() };
  }
  if (nowMs < end.getTime()) {
    return { live: true, target: end.getTime(), start: start.getTime(), end: end.getTime() };
  }
  const nextStart = start.getTime() + 7 * 24 * 60 * 60 * 1000;
  return {
    live: false,
    target: nextStart,
    start: nextStart,
    end: nextStart + CTF_HOURS * 60 * 60 * 1000,
  };
}

export function formatRemain(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

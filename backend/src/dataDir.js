/**
 * Durable host state (profiles, entries, rounds, …).
 * Prefer Railway volume mount, then ZKCTF_DATA_DIR, then /data if present;
 * else fall back to backend/data (ephemeral — causes churn on redeploy).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fallback = join(dirname(fileURLToPath(import.meta.url)), "../data");

function norm(p) {
  return String(p ?? "")
    .trim()
    .replace(/\/+$/, "") || "/";
}

function writable(dir) {
  try {
    mkdirSync(dir, { recursive: true });
    const probe = join(dir, ".write-probe");
    writeFileSync(probe, "ok");
    unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

/** True when path is a real mount (Railway volume), not just mkdir'd container FS. */
function isMountPoint(dir) {
  const target = norm(dir);
  for (const file of ["/proc/self/mountinfo", "/proc/mounts"]) {
    try {
      const text = readFileSync(file, "utf8");
      if (file.endsWith("mountinfo")) {
        // mountinfo: … mount-point …
        if (text.split("\n").some((line) => line.split(/\s+/)[4] === target)) return true;
      } else if (text.split("\n").some((line) => line.split(/\s+/)[1] === target)) {
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}

function railwayMount() {
  const p = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  return p ? norm(p) : null;
}

function resolve() {
  const rail = railwayMount();
  const fromEnv = process.env.ZKCTF_DATA_DIR?.trim() ? norm(process.env.ZKCTF_DATA_DIR) : null;

  // Prefer the Railway-attached volume when present (avoids writing to ephemeral /data).
  if (rail && writable(rail)) {
    if (fromEnv && fromEnv !== rail) {
      console.warn(`[data] ZKCTF_DATA_DIR=${fromEnv} ignored; using Railway volume ${rail}`);
    }
    return rail;
  }

  if (fromEnv) {
    if (!writable(fromEnv)) {
      console.error(`[data] ZKCTF_DATA_DIR=${fromEnv} is not writable — profiles will not persist`);
    } else if (!isMountPoint(fromEnv) && fromEnv !== rail) {
      console.warn(
        `[data] ZKCTF_DATA_DIR=${fromEnv} is writable but not a mount — redeploys may still wipe profiles`,
      );
    }
    return fromEnv;
  }

  if (existsSync("/data") && writable("/data")) {
    console.warn("[data] ZKCTF_DATA_DIR unset; using /data");
    return "/data";
  }

  console.warn(
    "[data] No volume — using ephemeral backend/data (redeploys wipe profiles). Attach a Railway volume at /data.",
  );
  mkdirSync(fallback, { recursive: true });
  return fallback;
}

export const DATA_DIR = resolve();
const rail = railwayMount();
export const dataPersistent =
  Boolean(rail && norm(DATA_DIR) === rail) || isMountPoint(DATA_DIR);

if (!dataPersistent) {
  console.error(
    `[data] NOT PERSISTENT dataDir=${DATA_DIR} railwayMount=${rail ?? "none"} — attach volume mount path /data (no trailing space)`,
  );
}

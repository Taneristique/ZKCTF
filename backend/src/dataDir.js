/**
 * Durable host state (profiles, entries, rounds, …).
 * Prefer ZKCTF_DATA_DIR; else use /data when that mount exists (Railway volume);
 * else fall back to backend/data (ephemeral in containers — causes churn on redeploy).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fallback = join(dirname(fileURLToPath(import.meta.url)), "../data");

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
  try {
    const mounts = readFileSync("/proc/mounts", "utf8");
    const target = dir.replace(/\/+$/, "") || "/";
    return mounts.split("\n").some((line) => {
      const parts = line.split(/\s+/);
      return parts[1] === target;
    });
  } catch {
    return false;
  }
}

function resolve() {
  const fromEnv = process.env.ZKCTF_DATA_DIR?.trim();
  if (fromEnv) {
    if (!writable(fromEnv)) {
      console.error(`[data] ZKCTF_DATA_DIR=${fromEnv} is not writable — profiles will not persist`);
    } else if (!isMountPoint(fromEnv)) {
      console.warn(
        `[data] ZKCTF_DATA_DIR=${fromEnv} is writable but not a mount — redeploys may still wipe profiles (attach a Railway volume)`,
      );
    }
    return fromEnv;
  }
  if (existsSync("/data") && writable("/data")) {
    console.warn("[data] ZKCTF_DATA_DIR unset; using /data volume");
    return "/data";
  }
  console.warn(
    "[data] ZKCTF_DATA_DIR unset and /data missing — using ephemeral backend/data (redeploys wipe profiles)",
  );
  mkdirSync(fallback, { recursive: true });
  return fallback;
}

export const DATA_DIR = resolve();
export const dataPersistent = isMountPoint(DATA_DIR);
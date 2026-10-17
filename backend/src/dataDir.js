/**
 * Durable host state (profiles, entries, rounds, …).
 * Prefer ZKCTF_DATA_DIR; else use /data when that mount exists (Railway volume);
 * else fall back to backend/data (ephemeral in containers — causes churn on redeploy).
 */
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
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

function resolve() {
  const fromEnv = process.env.ZKCTF_DATA_DIR?.trim();
  if (fromEnv) {
    if (!writable(fromEnv)) {
      console.error(`[data] ZKCTF_DATA_DIR=${fromEnv} is not writable — profiles will not persist`);
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
export const dataPersistent = DATA_DIR === "/data" || Boolean(process.env.ZKCTF_DATA_DIR?.trim());

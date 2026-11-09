#!/usr/bin/env node
/**
 * Seed $ZKCTF_DATA_DIR/lessons/published from the encrypted curriculum bundle
 * when the volume has no full lessons yet.
 *
 *   ZKCTF_LESSONS_PASSPHRASE=<secret> node scripts/ensure-lessons.mjs
 *
 * Bundle: scripts/fixtures/academy-lessons.tar.gz.enc (AES-256-CBC, PBKDF2).
 * Create/refresh: see scripts/seal-lessons.mjs then re-encrypt (OPS.md).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = (process.env.ZKCTF_DATA_DIR || join(ROOT, "backend/data")).replace(/\/+$/, "");
const dest = join(dataDir, "lessons/published");
const enc = join(ROOT, "scripts/fixtures/academy-lessons.tar.gz.enc");
const pass = (process.env.ZKCTF_LESSONS_PASSPHRASE || "").trim();

function publishedHasFlag() {
  if (!existsSync(dest)) return false;
  for (const f of readdirSync(dest).filter((x) => x.endsWith(".json"))) {
    try {
      const l = JSON.parse(readFileSync(join(dest, f), "utf8"));
      if (l.flag && l.body) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

mkdirSync(dest, { recursive: true });

if (publishedHasFlag()) {
  console.log("[ensure-lessons] full curriculum already present — skip");
  process.exit(0);
}

if (!pass) {
  console.warn(
    "[ensure-lessons] no full lessons on volume and ZKCTF_LESSONS_PASSPHRASE unset — members will only see stubs/teasers",
  );
  process.exit(0);
}

if (!existsSync(enc)) {
  console.warn("[ensure-lessons] missing", enc);
  process.exit(0);
}

const tmp = mkdtempSync(join(tmpdir(), "zkctf-lessons-"));
const tarPath = join(tmp, "lessons.tar.gz");
try {
  execFileSync(
    "openssl",
    ["enc", "-d", "-aes-256-cbc", "-pbkdf2", "-pass", `pass:${pass}`, "-in", enc, "-out", tarPath],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  execFileSync("tar", ["-xzf", tarPath, "-C", join(dataDir, "lessons")], { stdio: "inherit" });
  if (!publishedHasFlag()) {
    console.error("[ensure-lessons] decrypt/extract ran but no flagged lessons found — check passphrase/bundle");
    process.exit(1);
  }
  console.log("[ensure-lessons] seeded", dest);
} catch (e) {
  console.error("[ensure-lessons] failed:", e.stderr?.toString?.() || e.message || e);
  process.exit(1);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

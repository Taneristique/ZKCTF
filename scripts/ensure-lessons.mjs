#!/usr/bin/env node
/**
 * Seed $ZKCTF_DATA_DIR/lessons/published from the encrypted curriculum bundle
 * when the volume has no full lessons yet.
 *
 * Uses Node crypto (OpenSSL-compatible AES-256-CBC + PBKDF2) — no openssl CLI.
 *
 *   ZKCTF_LESSONS_PASSPHRASE=<secret> node scripts/ensure-lessons.mjs
 *
 * Bundle: scripts/fixtures/academy-lessons.tar.gz.enc
 */
import { execFileSync } from "node:child_process";
import { createDecipheriv, pbkdf2Sync } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = (process.env.ZKCTF_DATA_DIR || join(ROOT, "backend/data")).replace(/\/+$/, "");
const dest = join(dataDir, "lessons/published");
const encPath = join(ROOT, "scripts/fixtures/academy-lessons.tar.gz.enc");
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

/** Decrypt `openssl enc -aes-256-cbc -pbkdf2` (default 10000 iterations). */
function decryptOpenSslEnc(buf, password) {
  if (buf.length < 16 || buf.subarray(0, 8).toString("utf8") !== "Salted__") {
    throw new Error("not an OpenSSL salted enc file");
  }
  const salt = buf.subarray(8, 16);
  const ciphertext = buf.subarray(16);
  const keyIv = pbkdf2Sync(password, salt, 10_000, 48, "sha256");
  const key = keyIv.subarray(0, 32);
  const iv = keyIv.subarray(32, 48);
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

mkdirSync(dest, { recursive: true });
mkdirSync(join(dataDir, "lessons"), { recursive: true });

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

if (!existsSync(encPath)) {
  console.warn("[ensure-lessons] missing", encPath);
  process.exit(0);
}

const tmp = mkdtempSync(join(tmpdir(), "zkctf-lessons-"));
const tarPath = join(tmp, "lessons.tar.gz");
try {
  const plain = decryptOpenSslEnc(readFileSync(encPath), pass);
  writeFileSync(tarPath, plain);
  execFileSync("tar", ["-xzf", tarPath, "-C", join(dataDir, "lessons")], { stdio: ["ignore", "pipe", "pipe"] });
  if (!publishedHasFlag()) {
    console.error(
      "[ensure-lessons] decrypt/extract ran but no flagged lessons in",
      dest,
      "files=",
      existsSync(dest) ? readdirSync(dest).join(",") : "(missing)",
    );
    process.exit(1);
  }
  console.log("[ensure-lessons] seeded", dest, "count=", readdirSync(dest).filter((f) => f.endsWith(".json")).length);
} catch (e) {
  const detail = e.stderr?.toString?.() || e.message || e;
  console.error("[ensure-lessons] failed:", detail);
  process.exit(1);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

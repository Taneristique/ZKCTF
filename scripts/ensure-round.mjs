/**
 * Boot helper: if $ZKCTF_DATA_DIR/round.json is missing or for the wrong window,
 * restore the dated rescue fixture or write official seeds for this Saturday.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.ZKCTF_DATA_DIR || join(ROOT, "backend/data");
mkdirSync(dataDir, { recursive: true });
const dest = join(dataDir, "round.json");

const { saturdayWindow } = await import(pathToFileURL(join(ROOT, "backend/src/race.js")).href);
const { start, end } = saturdayWindow();
const startIso = start.toISOString();

if (existsSync(dest)) {
  try {
    const row = JSON.parse(readFileSync(dest, "utf8"));
    if (row?.start === startIso && Array.isArray(row.levels) && row.levels.length) {
      console.log(`[ensure-round] ok ${dest} (${row.source ?? "unknown"})`);
      process.exit(0);
    }
  } catch {
    /* rewrite below */
  }
}

const fixture = join(ROOT, "scripts/fixtures/round-2026-10-17-rescue.json");
if (existsSync(fixture)) {
  try {
    const row = JSON.parse(readFileSync(fixture, "utf8"));
    if (row?.start === startIso) {
      copyFileSync(fixture, dest);
      console.log(`[ensure-round] restored fixture → ${dest}`);
      process.exit(0);
    }
  } catch (e) {
    console.error("[ensure-round] fixture read failed", e);
  }
}

const { OFFICIAL } = await import(pathToFileURL(join(ROOT, "backend/src/seeds.js")).href);
const { writeRound } = await import(pathToFileURL(join(ROOT, "backend/src/roundStore.js")).href);
const row = writeRound({
  start: startIso,
  end: end.toISOString(),
  levels: OFFICIAL,
  source: "ensure-seeds",
});
console.log(`[ensure-round] wrote ${row.source} → ${dest}`);

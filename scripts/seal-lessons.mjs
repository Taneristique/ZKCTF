#!/usr/bin/env node
/**
 * Move full Academy bodies + flags off the public git tree.
 *
 *   1) Copy every backend/content/lessons/published/*.json → $ZKCTF_DATA_DIR/lessons/published/
 *      (default: backend/data/lessons/published — already gitignored)
 *   2) Replace repo files with public stubs (metadata; teaser may keep body, never flag)
 *
 * After sealing, deploy/sync the data-dir copy to Railway `/data/lessons/published/`.
 *
 *   node scripts/seal-lessons.mjs
 *   node scripts/seal-lessons.mjs --dry-run
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_PUBLISHED = join(ROOT, "backend/content/lessons/published");
const dataRoot = (process.env.ZKCTF_DATA_DIR || join(ROOT, "backend/data")).replace(/\/+$/, "");
const DATA_PUBLISHED = join(dataRoot, "lessons/published");
const dry = process.argv.includes("--dry-run");

/** Public git stub: no flag; non-teaser has no body/exercise. */
export function toPublicStub(lesson) {
  const stub = {
    id: lesson.id,
    week: lesson.week,
    track: lesson.track,
    title: lesson.title,
    summary: lesson.summary,
    case: lesson.case ?? null,
    authors: lesson.authors ?? { ai: null, human: null },
    reviewed: true,
    status: "published",
    teaser: Boolean(lesson.teaser),
    publishedAt: lesson.publishedAt,
    rights: lesson.rights,
  };
  if (stub.teaser) {
    stub.body = lesson.body;
    stub.exercise = {
      statement: lesson.exercise?.statement ?? "",
      artifacts: Array.isArray(lesson.exercise?.artifacts) ? lesson.exercise.artifacts : [],
      hints: Array.isArray(lesson.exercise?.hints) ? lesson.exercise.hints : [],
    };
  }
  return stub;
}

function isAlreadyStub(l) {
  return !l.flag && (l.teaser ? Boolean(l.body) : !l.body);
}

mkdirSync(DATA_PUBLISHED, { recursive: true });
const files = readdirSync(REPO_PUBLISHED).filter((f) => f.endsWith(".json"));
let sealed = 0;
let skipped = 0;

for (const f of files) {
  const repoPath = join(REPO_PUBLISHED, f);
  const full = JSON.parse(readFileSync(repoPath, "utf8"));
  if (full.status !== "published") {
    console.log(`skip (not published): ${f}`);
    skipped++;
    continue;
  }
  if (isAlreadyStub(full) && existsSync(join(DATA_PUBLISHED, f))) {
    console.log(`ok (already sealed): ${f}`);
    skipped++;
    continue;
  }
  if (!full.flag && !full.body && !existsSync(join(DATA_PUBLISHED, f))) {
    console.warn(`warn: ${f} looks like a stub but no data-dir full copy — restore full JSON before sealing`);
    skipped++;
    continue;
  }

  const dataPath = join(DATA_PUBLISHED, f);
  const stub = toPublicStub(full);
  console.log(`${dry ? "dry " : ""}seal ${full.id} → data + repo stub (teaser=${Boolean(stub.teaser)})`);
  if (!dry) {
    // Prefer keeping an existing fuller data copy; otherwise write current repo file as source of truth.
    if (!existsSync(dataPath) || full.flag || full.body) {
      writeFileSync(dataPath, `${JSON.stringify(full, null, 2)}\n`);
    }
    writeFileSync(repoPath, `${JSON.stringify(stub, null, 2)}\n`);
  }
  sealed++;
}

console.log(`\nDone. sealed=${sealed} skipped=${skipped} dataDir=${DATA_PUBLISHED}`);
console.log("Deploy: sync that folder to Railway volume /data/lessons/published/");

#!/usr/bin/env node
/**
 * Tree-filter helper for scripts/scrub-lesson-history.sh.
 * Stub-ifies backend/content/lessons/published/*.json in the current checkout
 * (drops flag; drops body/exercise unless teaser). Does not touch DATA_DIR.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join("backend/content/lessons/published");
if (!existsSync(dir)) process.exit(0);

for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const p = join(dir, f);
  let l;
  try {
    l = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    continue;
  }
  if (!l.flag && (l.teaser ? l.body : !l.body)) continue;
  const stub = {
    id: l.id,
    week: l.week,
    track: l.track,
    title: l.title,
    summary: l.summary,
    case: l.case ?? null,
    authors: l.authors ?? { ai: null, human: null },
    reviewed: true,
    status: "published",
    teaser: Boolean(l.teaser),
    publishedAt: l.publishedAt,
    rights: l.rights,
  };
  if (stub.teaser && l.body) {
    stub.body = l.body;
    stub.exercise = {
      statement: l.exercise?.statement ?? "",
      artifacts: Array.isArray(l.exercise?.artifacts) ? l.exercise.artifacts : [],
      hints: Array.isArray(l.exercise?.hints) ? l.exercise.hints : [],
    };
  }
  writeFileSync(p, `${JSON.stringify(stub, null, 2)}\n`);
}

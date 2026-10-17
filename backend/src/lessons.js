/**
 * Weekly Academy lessons: AI-drafted, human-reviewed, published by the host.
 *
 * Load order (later overrides same id):
 *   1) backend/content/lessons/published/*.json  (repo — prefer teasers only if public)
 *   2) $ZKCTF_DATA_DIR/lessons/published/*.json (volume — full member curriculum)
 *
 * Drafts live in backend/content/lessons/drafts/ and are never served.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FOUNDING } from "./membership.js";
import { DATA_DIR } from "./dataDir.js";

export const LESSONS_DIR =
  process.env.ZKCTF_LESSONS_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "../content/lessons");
const REPO_PUBLISHED = join(LESSONS_DIR, "published");
const VOLUME_PUBLISHED = join(DATA_DIR, "lessons/published");

export const TRACKS = {
  security: { id: "security", en: "Cybersecurity", tr: "Siber güvenlik", es: "Ciberseguridad" },
  math: {
    id: "math",
    en: "Math for cybersecurity",
    tr: "Siber güvenlik için matematik",
    es: "Matemática para ciberseguridad",
  },
};

export const DEFAULT_RIGHTS = {
  holder: "ZKCTF",
  notice:
    "© ZKCTF Academy. Licensed for personal study by active members only. No scraping, training use, or republication of the full body.",
  license: "AllRightsReserved",
};

function readDirJson(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          return JSON.parse(readFileSync(join(dir, f), "utf8"));
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function loadLessons() {
  const byId = new Map();
  for (const l of readDirJson(REPO_PUBLISHED)) {
    if (l.status === "published" && l.reviewed === true && TRACKS[l.track]) byId.set(l.id, l);
  }
  // Volume wins: keep full curriculum off the public git tree when desired.
  if (existsSync(VOLUME_PUBLISHED)) {
    for (const l of readDirJson(VOLUME_PUBLISHED)) {
      if (l.status === "published" && l.reviewed === true && TRACKS[l.track]) byId.set(l.id, l);
    }
  }
  return [...byId.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

/** Founding members see each lesson FOUNDING.earlyAccessHours before everyone else. */
export function opensAt(lesson, founding) {
  const at = Date.parse(lesson.publishedAt);
  return founding ? at - FOUNDING.earlyAccessHours * 3600_000 : at;
}

function rightsOf(lesson) {
  return { ...DEFAULT_RIGHTS, ...(lesson.rights ?? {}) };
}

function meta(lesson) {
  return {
    id: lesson.id,
    week: lesson.week,
    track: lesson.track,
    title: lesson.title,
    summary: lesson.summary,
    case: lesson.case ?? null,
    authors: lesson.authors,
    publishedAt: lesson.publishedAt,
    rights: rightsOf(lesson),
  };
}

/** Free preview lessons: set `"teaser": true` in the JSON. Full catalog otherwise needs a seat. */
export function isTeaser(lesson) {
  return Boolean(lesson?.teaser);
}

/** Catalog for a viewer. Locked rows expose metadata only. */
export function lessonCatalog(member, now = Date.now()) {
  const founding = Boolean(member?.founding);
  return loadLessons()
    .filter((l) => opensAt(l, founding) <= now)
    .map((l) => ({
      ...meta(l),
      teaser: isTeaser(l),
      early: now < Date.parse(l.publishedAt),
      unlocked: Boolean(member?.active) || isTeaser(l),
    }));
}

export function lessonFor(id, member, now = Date.now()) {
  const lesson = loadLessons().find((l) => l.id === id);
  if (!lesson || opensAt(lesson, Boolean(member?.founding)) > now) return { error: 404 };
  const free = isTeaser(lesson);
  if (!member?.active && !free) return { error: 403, lesson: meta(lesson) };
  const { flag, ...rest } = lesson;
  return {
    lesson: {
      ...rest,
      teaser: free,
      rights: rightsOf(lesson),
    },
  };
}

export function lessonFlag(id) {
  return loadLessons().find((l) => l.id === id)?.flag ?? null;
}

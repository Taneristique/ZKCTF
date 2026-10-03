/**
 * Weekly Academy lessons: AI-drafted, human-reviewed, published by the host.
 * Source of truth is content/lessons/published/*.json (versioned with the repo).
 * Drafts live in content/lessons/drafts/ and are never served.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FOUNDING } from "./membership.js";

export const LESSONS_DIR =
  process.env.ZKCTF_LESSONS_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "../../content/lessons");
const PUBLISHED = join(LESSONS_DIR, "published");

export const TRACKS = {
  security: { id: "security", en: "Cybersecurity", tr: "Siber güvenlik", es: "Ciberseguridad" },
  math: {
    id: "math",
    en: "Math for cybersecurity",
    tr: "Siber güvenlik için matematik",
    es: "Matemática para ciberseguridad",
  },
};

export function loadLessons() {
  let files = [];
  try {
    files = readdirSync(PUBLISHED).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  return files
    .map((f) => JSON.parse(readFileSync(join(PUBLISHED, f), "utf8")))
    .filter((l) => l.status === "published" && l.reviewed === true && TRACKS[l.track])
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

/** Founding members see each lesson FOUNDING.earlyAccessHours before everyone else. */
export function opensAt(lesson, founding) {
  const at = Date.parse(lesson.publishedAt);
  return founding ? at - FOUNDING.earlyAccessHours * 3600_000 : at;
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
  };
}

/** Catalog for a viewer. Locked rows expose metadata only. */
export function lessonCatalog(member, now = Date.now()) {
  const founding = Boolean(member?.founding);
  return loadLessons()
    .filter((l) => opensAt(l, founding) <= now)
    .map((l) => ({
      ...meta(l),
      early: now < Date.parse(l.publishedAt),
      unlocked: Boolean(member?.active),
    }));
}

export function lessonFor(id, member, now = Date.now()) {
  const lesson = loadLessons().find((l) => l.id === id);
  if (!lesson || opensAt(lesson, Boolean(member?.founding)) > now) return { error: 404 };
  if (!member?.active) return { error: 403, lesson: meta(lesson) };
  const { flag, ...rest } = lesson;
  return { lesson: rest };
}

export function lessonFlag(id) {
  return loadLessons().find((l) => l.id === id)?.flag ?? null;
}

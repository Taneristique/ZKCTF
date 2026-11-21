/**
 * Free public demo CTF — no SOL entry, no pot, no Groth16.
 * Funnel into the Saturday paid race. Flags checked host-side only.
 */
import { createHash } from "node:crypto";
import { flagsEqual } from "./relation.mjs";
import { dataPath, load, save } from "./store.js";

const PATH = dataPath("demo-solves.json");

/** Fixed easy set — stable across restarts so shareable walkthroughs stay valid. */
export const DEMO_LEVELS = [
  {
    id: 0,
    title: "Warm-up XOR",
    statement:
      "A short lowercase English word was XOR-ed byte by byte with the repeating key \"ctf\" (c, t, f, c, t, …). The result in hex is 1306090c12. Undo the XOR to recover the word. Answer ZKCTF{word}.",
    artifacts: ["1306090c12"],
    hints: [
      "XOR is its own inverse: XOR each byte with the same key letter again.",
      "c = 0x63, t = 0x74, f = 0x66. The first byte is 0x13 ^ 0x63.",
    ],
    flag: "ZKCTF{proof}",
  },
  {
    id: 1,
    title: "Chinese remainder lite",
    statement:
      "Find a whole number x between 0 and 104 that fits all three: divide by 3 and the remainder is 2; divide by 5 and the remainder is 3; divide by 7 and the remainder is 2. Answer ZKCTF{x}.",
    artifacts: [],
    hints: [
      "3 × 5 × 7 = 105, so there is only one such x in 0..104.",
      "Numbers with remainder 2 after dividing by 7 are 2, 9, 16, … — check each against the other two rules.",
    ],
    flag: "ZKCTF{23}",
  },
];

export function publicDemoLevels() {
  return DEMO_LEVELS.map(({ flag, ...rest }) => rest);
}

export function demoLevelById(id) {
  return DEMO_LEVELS.find((l) => Number(l.id) === Number(id)) ?? null;
}

function db() {
  return load(PATH);
}

function keyFor(wallet) {
  return wallet ? String(wallet) : `anon:${createHash("sha256").update("guest").digest("hex").slice(0, 16)}`;
}

export function demoProgress(wallet) {
  const row = db()[keyFor(wallet)] ?? { solved: [] };
  const solved = Array.isArray(row.solved) ? row.solved.map(Number) : [];
  const n = DEMO_LEVELS.length;
  const next = DEMO_LEVELS.find((l) => !solved.includes(l.id))?.id ?? null;
  return {
    solved,
    next,
    cleared: solved.length >= n,
    levelCount: n,
    free: true,
    entrySol: 0,
  };
}

export function checkDemoFlag(wallet, levelId, flag) {
  const level = demoLevelById(levelId);
  if (!level) return { ok: false, error: "Unknown demo level." };
  if (!flagsEqual(String(flag ?? "").trim(), level.flag)) {
    return { ok: false, error: "That flag doesn’t match. Try again." };
  }
  const all = db();
  const k = keyFor(wallet);
  const row = all[k] ?? { solved: [] };
  const solved = new Set(row.solved.map(Number));
  // Linear unlock: must solve in order.
  if (levelId > 0 && !solved.has(levelId - 1)) {
    return { ok: false, error: "Solve the previous demo CTF first." };
  }
  solved.add(Number(levelId));
  all[k] = { solved: [...solved].sort((a, b) => a - b), at: Date.now() };
  save(PATH, all);
  const progress = demoProgress(wallet);
  return {
    ok: true,
    progress,
    note: progress.cleared
      ? "Demo cleared. Enter the Saturday race (0.05 SOL) for the real pot + Groth16 board."
      : "Correct. Next demo CTF is open.",
  };
}

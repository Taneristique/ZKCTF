import { test } from "node:test";
import assert from "node:assert/strict";
import { TYPES, buildRound, checkLevel, FLAG_RE } from "../src/ctfgen.js";
import { generateRound, docFor } from "../src/bot.js";

test("every puzzle type has a definite, re-derivable answer", () => {
  for (const [type, t] of Object.entries(TYPES)) {
    assert.ok(docFor(t.doc), `${type}: doc ${t.doc} missing from ctf-docs/index.json`);
    let rejected = 0;
    for (let i = 0; i < 200; i++) if (checkLevel(type, t.build()).length) rejected++;
    // A rejected draw is redrawn by buildRound, but it must be rare.
    assert.ok(rejected < 20, `${type}: ${rejected}/200 draws rejected`);
  }
});

test("rounds are four levels, easiest first, all verified", () => {
  for (let i = 0; i < 300; i++) {
    const levels = buildRound();
    assert.equal(levels.length, 4);
    assert.deepEqual(levels.map((l) => TYPES[l.type].tier), [0, 1, 2, 3]);
    for (const lv of levels) {
      assert.match(lv.flag, FLAG_RE);
      assert.ok(Buffer.byteLength(lv.flag) <= 32);
      assert.deepEqual(checkLevel(lv.type, lv), []);
    }
    assert.equal(new Set(levels.map((l) => l.flag)).size, 4);
  }
});

test("avoid list rotates puzzle types week to week", () => {
  const prev = buildRound().map((l) => l.type);
  const next = buildRound({ avoid: prev }).map((l) => l.type);
  for (const [i, t] of next.entries()) {
    const tierHasAlt = Object.values(TYPES).filter((x) => x.tier === TYPES[t].tier).length > 1;
    if (tierHasAlt) assert.notEqual(t, prev[i]);
  }
});

test("generateRound works offline without AI", async () => {
  const { levels, source } = await generateRound({ ai: false });
  assert.equal(source, "procedural");
  assert.equal(levels.length, 4);
});

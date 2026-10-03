import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { splitPot, ENTRY_ATOMS, TREASURY_BPS } from "../../../backend/src/payout.js";

function disc(name) {
  return [...createHash("sha256").update(`global:${name}`).digest().subarray(0, 8)];
}

assert.deepEqual(disc("initialize"), [175, 175, 109, 31, 13, 152, 155, 237]);
assert.deepEqual(disc("mint_seat"), [174, 36, 106, 250, 202, 238, 71, 231]);
assert.deepEqual(disc("create_round"), [229, 218, 236, 169, 231, 80, 134, 112]);
assert.deepEqual(disc("submit"), [88, 166, 102, 181, 162, 127, 170, 48]);
assert.deepEqual(disc("enter_round"), [166, 162, 71, 230, 92, 51, 37, 43]);
assert.deepEqual(disc("settle"), [175, 42, 185, 87, 144, 131, 102, 212]);

const one = splitPot(ENTRY_ATOMS, 1);
assert.equal(one.treasury, 1_000_000);
assert.equal(one.pays[0], 4_000_000);
const none = splitPot(3 * ENTRY_ATOMS, 0);
assert.equal(none.treasury, 15_000_000);
assert.equal(TREASURY_BPS, 2000);
console.log("program unit ok");

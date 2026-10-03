import { randomBytes } from "node:crypto";
import {
  createCommitment,
  playerCommitment,
  circuitInput,
  pad32,
} from "../lib/relation.mjs";

const flag = "ZKCTF{xor-1}";
const delta = randomBytes(32);
const nonce = randomBytes(32);
const P = randomBytes(32);
const { s, h } = createCommitment(flag, delta);
const play = playerCommitment(P, flag, nonce);
if (Buffer.compare(play.s, s) !== 0) throw new Error("s mismatch");
const input = circuitInput({
  s,
  delta: pad32(delta),
  nonce: play.nonce,
  P,
  h,
  C: play.C,
});
console.log(JSON.stringify({ ok: true, h: Buffer.from(h).toString("hex"), C: Buffer.from(play.C).toString("hex"), input }, null, 2));

const wrong = playerCommitment(P, "nope", nonce);
if (Buffer.compare(wrong.C, play.C) === 0) throw new Error("wrong flag collided");
console.log("wrong-flag C differs: ok");

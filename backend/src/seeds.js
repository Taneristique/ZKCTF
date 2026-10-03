import { randomBytes } from "node:crypto";
import { createCommitment, hex32 } from "./relation.mjs";

function level(id, title, statement, flag, artifacts = [], hints = [], walkthrough = "") {
  const delta = randomBytes(32);
  const { h } = createCommitment(flag, delta);
  return {
    id,
    title,
    statement,
    artifacts,
    hints,
    walkthrough,
    flag,
    delta: hex32(delta),
    h: hex32(h),
  };
}

export const OFFICIAL = [
  level(
    0,
    "Hidden word",
    "A short lowercase English word was XOR-ed byte by byte with the repeating key \"ctf\" (c, t, f, c, t, …). The result in hex is 1306090c12. Undo the XOR to recover the word. Answer ZKCTF{word}.",
    "ZKCTF{proof}",
    ["1306090c12"],
    [
      "XOR is its own inverse: XOR each byte with the same key letter again.",
      "c = 0x63, t = 0x74, f = 0x66. The first byte is 0x13 ^ 0x63.",
    ],
    "Bytes 13 06 09 0c 12 XOR key 63 74 66 63 74: 0x13^0x63=0x70 'p', 0x06^0x74=0x72 'r', 0x09^0x66=0x6f 'o', 0x0c^0x63=0x6f 'o', 0x12^0x74=0x66 'f' → proof.",
  ),
  level(
    1,
    "One number, three rules",
    "Find a whole number x between 0 and 104 that fits all three: divide by 3 and the remainder is 2; divide by 5 and the remainder is 3; divide by 7 and the remainder is 2. Answer ZKCTF{x}.",
    "ZKCTF{23}",
    [],
    [
      "3 × 5 × 7 = 105, so there is only one such x in 0..104.",
      "Numbers with remainder 2 after dividing by 7 are 2, 9, 16, … — check each against the other two rules.",
    ],
    "Candidates with x mod 7 = 2: 2, 9, 16, 23, … 2 mod 5 = 2 ✗, 9 mod 5 = 4 ✗, 16 mod 5 = 1 ✗, 23 mod 5 = 3 ✓ and 23 mod 3 = 2 ✓ → 23.",
  ),
  level(
    2,
    "Power leftover",
    "Multiply 3 by itself 16 times, then divide that huge number by 17. What is the remainder (the leftover, 0–16)? You do not need to write the huge number out. Answer ZKCTF{the leftover}.",
    "ZKCTF{1}",
    [],
    [
      "You only need the leftover after dividing by 17, not the full number.",
      "Square repeatedly: find 3², 3⁴, 3⁸, 3¹⁶, keeping only the leftover mod 17 at each step.",
    ],
    "3² = 9; 3⁴ = 81 → 81 − 68 = 13; 3⁸ = 13² = 169 → 169 − 153 = 16; 3¹⁶ = 16² = 256 → 256 − 255 = 1. (Also Fermat: 3¹⁶ ≡ 1 mod 17.)",
  ),
  level(
    3,
    "Anyone can take over",
    "A contract stores owner = 0xA1. Its function setOwner(newPerson) writes the new owner with no check on who is calling, so any wallet can make itself owner. Which bug class from the list below is this? Answer ZKCTF{class}.",
    "ZKCTF{missing_auth}",
    ["reentrancy", "integer_overflow", "missing_auth", "front_running", "oracle_manipulation"],
    ["Who is allowed to call setOwner?", "Nothing re-enters, no arithmetic, no price feed — only a missing caller check."],
    "setOwner never checks msg.sender (no onlyOwner). A privileged function callable by anyone is missing authorization → missing_auth. The other classes need re-entrant calls, arithmetic wrap, transaction ordering, or a price oracle.",
  ),
];

export const CUSTOM_SEEDS = [
  {
    topic: "missing-auth",
    statement:
      "A contract has setOwner(newPerson) with no check. Anyone can become owner. What is this bug usually called, in snake_case? Answer ZKCTF{the_name}.",
    flag: "ZKCTF{missing_auth}",
    hints: ["Who is allowed to call setOwner?", "There is no onlyOwner check."],
    walkthrough: "missing_auth.",
    artifacts: [],
  },
  {
    topic: "modular-inverse",
    statement:
      "Which small whole number times 3 leaves remainder 1 when you divide by 11? Put that number in ZKCTF{…}.",
    flag: "ZKCTF{4}",
    hints: ["Try 1, 2, 3, 4… until 3 × n is one more than a multiple of 11.", "3 × 4 = 12."],
    walkthrough: "4 is the inverse.",
    artifacts: [],
  },
  {
    topic: "xor-one-time",
    statement:
      "One letter was hidden. Mix 0x0a with 0x7b (XOR). The result is a normal ASCII letter. Answer ZKCTF{that letter}.",
    flag: "ZKCTF{q}",
    hints: ["XOR means bits that differ become 1.", "0x0a xor 0x7b = 0x71, which is 'q'."],
    walkthrough: "0x71 = 'q'.",
    artifacts: [],
  },
];

export function publicOfficial() {
  return OFFICIAL.map(({ flag, delta, ...rest }) => rest);
}

export function officialSecrets() {
  return OFFICIAL.map((l) => ({ id: l.id, flag: l.flag, delta: l.delta, h: l.h }));
}

/**
 * Weekly CTF generator with definite answers.
 *
 * Every puzzle type is a documented vulnerability class (backend/content/ctf-docs/<doc>.md, with
 * CWE / SWC / RFC references). Parameters are drawn with crypto randomness, the flag is computed
 * by code, and each type has an independent solve() that re-derives the flag from the
 * player-visible data only. A level is kept only if solve() returns exactly the flag and the
 * answer is unique. AI may add a story intro (see bot.js) but never touches data or answers.
 */
import { createHash, createHmac, randomInt } from "node:crypto";

export const FLAG_RE = /^ZKCTF\{[a-z0-9_-]{1,25}\}$/;

export const WORDS = [
  "nonce", "salt", "cipher", "padding", "oracle", "replay", "sandbox", "keystore", "entropy",
  "checksum", "firewall", "payload", "exploit", "honeypot", "rootkit", "phishing", "backdoor",
  "overflow", "signature", "merkle", "ledger", "validator", "multisig", "escrow", "slippage",
  "bridge", "token", "vault", "proof", "witness", "circuit", "commit", "hash", "kernel", "socket",
];

const pick = (arr) => arr[randomInt(arr.length)];
const flag = (body) => `ZKCTF{${body}}`;
const body = (f) => f.slice(6, -1);

function twoWords(maxLen = 25) {
  for (;;) {
    const a = pick(WORDS);
    const b = pick(WORDS);
    if (a !== b && a.length + b.length + 1 <= maxLen) return `${a}_${b}`;
  }
}

function modpow(b, e, m) {
  let r = 1n;
  b %= m;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return r;
}

function egcdInv(a, m) {
  let [r0, r1, s0, s1] = [((a % m) + m) % m, m, 1n, 0n];
  while (r1) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  if (r0 !== 1n) return null;
  return ((s0 % m) + m) % m;
}

function isPrime(n) {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

function randomPrime(lo, hi) {
  for (;;) {
    const n = randomInt(lo, hi);
    if (isPrime(n)) return n;
  }
}

const shift = (s, k) =>
  s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + k + 26) % 26) + 97));

const b64url = (s) => Buffer.from(s).toString("base64url");

/** Each type: tier (0 easiest), doc id, build() → level, solve(level) → flag or list of candidates. */
export const TYPES = {
  caesar: {
    tier: 0,
    doc: "classical-ciphers",
    build() {
      const plain = twoWords();
      const k = randomInt(1, 26);
      const ct = shift(plain, k);
      return {
        title: "Shifted log line",
        statement: `An old logging library "protected" secrets by rotating every letter forward by the same secret amount (a Caesar shift; underscores are left alone). One protected value is in the artifacts. It decodes to two lowercase English security words joined by an underscore. Answer ZKCTF{decoded_value}.`,
        artifacts: [ct],
        hints: ["There are only 25 possible shifts. Try them all.", "Exactly one shift produces two real words."],
        walkthrough: `Shift each letter back by ${k}: ${ct} → ${plain}.`,
        flag: flag(plain),
      };
    },
    solve(lv) {
      const ct = lv.artifacts[0];
      return Array.from({ length: 25 }, (_, i) => shift(ct, -(i + 1)))
        .filter((p) => p.split("_").every((w) => WORDS.includes(w)))
        .map(flag);
    },
  },

  uint8: {
    tier: 0,
    doc: "integer-overflow",
    build() {
      const have = randomInt(3, 60);
      const dmg = randomInt(have + 1, have + 200);
      const out = (((have - dmg) % 256) + 256) % 256;
      return {
        title: "Unchecked lives",
        statement: `A game contract compiled with Solidity 0.7 (no automatic overflow checks) stores each player's lives as a uint8, which holds 0 to 255. A player with ${have} lives takes ${dmg} damage, and the contract runs lives = lives - ${dmg} with no require() before it. What value is stored in lives afterwards? Answer ZKCTF{number}.`,
        artifacts: ["uint8 lives;", `lives = lives - ${dmg};`],
        hints: ["uint8 arithmetic is done modulo 256.", "Below zero, it wraps around to the top of the range."],
        walkthrough: `${have} − ${dmg} = ${have - dmg}; modulo 256 that is ${out}.`,
        flag: flag(String(out)),
      };
    },
    solve(lv) {
      const [have, dmg] = lv.statement.match(/with (\d+) lives takes (\d+) damage/).slice(1).map(Number);
      return flag(String((((have - dmg) % 256) + 256) % 256));
    },
  },

  encoding: {
    tier: 0,
    doc: "encoding-is-not-encryption",
    build() {
      const pw = twoWords();
      const hex = Buffer.from(Buffer.from(pw).toString("base64")).toString("hex");
      return {
        title: "Encoded, not encrypted",
        statement: `A config file stores an admin password after "securing" it in two steps: first Base64, then the Base64 text written out as hex. The stored value is in the artifacts. Recover the password. Answer ZKCTF{password}.`,
        artifacts: [hex],
        hints: ["Undo the steps in reverse order: hex first, then Base64.", "Encoding needs no key, so anyone can reverse it."],
        walkthrough: `hex → "${Buffer.from(pw).toString("base64")}" → Base64 decode → ${pw}.`,
        flag: flag(pw),
      };
    },
    solve(lv) {
      return flag(Buffer.from(Buffer.from(lv.artifacts[0], "hex").toString(), "base64").toString());
    },
  },

  xorKnownPlaintext: {
    tier: 1,
    doc: "xor-key-reuse",
    build() {
      const f = flag(twoWords(18));
      const key = Array.from({ length: 6 }, () => randomInt(1, 256));
      const ct = Buffer.from(f).map((b, i) => b ^ key[i % 6]);
      return {
        title: "Known prefix",
        statement: `A flag was XOR-encrypted with a secret 6-byte key, repeated over the whole message. Every flag on this site starts with the six characters ZKCTF{ . The ciphertext (hex) is in the artifacts. Recover the full flag and submit it as is.`,
        artifacts: [Buffer.from(ct).toString("hex")],
        hints: ["XOR the first 6 ciphertext bytes with the known prefix to get the key.", "Then apply the key, repeated, to every byte."],
        walkthrough: `key = ct[0..6] XOR "ZKCTF{" = ${Buffer.from(key).toString("hex")}; repeating it over the ciphertext gives ${f}.`,
        flag: f,
      };
    },
    solve(lv) {
      const ct = Buffer.from(lv.artifacts[0], "hex");
      const key = Buffer.from("ZKCTF{").map((b, i) => b ^ ct[i]);
      return ct.map((b, i) => b ^ key[i % 6]).toString();
    },
  },

  lcg: {
    tier: 1,
    doc: "weak-prng",
    build() {
      for (;;) {
        const m = randomPrime(1000, 10000);
        const a = randomInt(2, m - 1);
        const c = randomInt(1, m - 1);
        const xs = [randomInt(1, m)];
        for (let i = 0; i < 4; i++) xs.push((a * xs[i] + c) % m);
        const [, x1, x2, x3, x4] = xs;
        if (x1 === x2) continue;
        return {
          title: "Predictable lottery",
          statement: `A raffle contract draws numbers with a linear congruential generator: next = (a × current + c) mod m, with m = ${m} (a prime). a and c are secret. The last three draws were ${x1}, ${x2}, ${x3}. What is the next draw? Answer ZKCTF{number}.`,
          artifacts: [`m = ${m}`, `draws: ${x1}, ${x2}, ${x3}`],
          hints: [
            "Subtract consecutive draws: (x3 − x2) = a × (x2 − x1) mod m.",
            "Divide by (x2 − x1) using its modular inverse, then c = x2 − a × x1 mod m.",
          ],
          walkthrough: `a = (${x3} − ${x2}) × (${x2} − ${x1})⁻¹ mod ${m} = ${a}; c = ${x2} − a × ${x1} mod ${m} = ${c}; next = (a × ${x3} + c) mod ${m} = ${x4}.`,
          flag: flag(String(x4)),
        };
      }
    },
    solve(lv) {
      const m = BigInt(lv.artifacts[0].match(/\d+/)[0]);
      const [x1, x2, x3] = lv.artifacts[1].match(/\d+/g).map(BigInt);
      const inv = egcdInv(x2 - x1, m);
      const a = ((((x3 - x2) * inv) % m) + m) % m;
      const c = (((x2 - a * x1) % m) + m) % m;
      return flag(String((a * x3 + c) % m));
    },
  },

  crt: {
    tier: 1,
    doc: "modular-arithmetic",
    build() {
      const ms = [];
      while (ms.length < 3) {
        const p = randomPrime(3, 30);
        if (!ms.includes(p)) ms.push(p);
      }
      const M = ms.reduce((x, y) => x * y, 1);
      const x = randomInt(1, M);
      const rs = ms.map((m) => x % m);
      return {
        title: "Three clocks",
        statement: `A wallet PIN x is between 0 and ${M - 1}. Three leaked checks say: x mod ${ms[0]} = ${rs[0]}, x mod ${ms[1]} = ${rs[1]}, x mod ${ms[2]} = ${rs[2]}. Find x. Answer ZKCTF{x}.`,
        artifacts: ms.map((m, i) => `x mod ${m} = ${rs[i]}`),
        hints: [`${ms.join(" × ")} = ${M}, so there is exactly one answer in range (Chinese Remainder Theorem).`, "Walk through numbers that satisfy the largest modulus and test the other two."],
        walkthrough: `CRT over moduli ${ms.join(", ")} (product ${M}) gives x = ${x}.`,
        flag: flag(String(x)),
      };
    },
    solve(lv) {
      const eqs = lv.artifacts.map((a) => a.match(/\d+/g).map(Number));
      const M = eqs.reduce((p, [m]) => p * m, 1);
      const hits = [];
      for (let x = 0; x < M; x++) if (eqs.every(([m, r]) => x % m === r)) hits.push(flag(String(x)));
      return hits;
    },
  },

  rsaSmall: {
    tier: 2,
    doc: "rsa-key-size",
    build() {
      for (;;) {
        const p = randomPrime(200, 1000);
        const q = randomPrime(200, 1000);
        if (p === q) continue;
        const n = BigInt(p * q);
        const phi = BigInt((p - 1) * (q - 1));
        const e = [17n, 257n, 65537n].find((x) => egcdInv(x, phi));
        if (!e) continue;
        const m = BigInt(randomInt(2, p * q - 1));
        const c = modpow(m, e, n);
        return {
          title: "Tiny RSA",
          statement: `A legacy API signs session numbers with RSA, but its modulus is far too small. Public key: n = ${n}, e = ${e}. An intercepted ciphertext is c = ${c}. Recover the plaintext number m. Answer ZKCTF{m}.`,
          artifacts: [`n = ${n}`, `e = ${e}`, `c = ${c}`],
          hints: ["Factor n by trial division; both primes are under 1000.", "d = e⁻¹ mod (p−1)(q−1), then m = c^d mod n."],
          walkthrough: `n = ${p} × ${q}; φ = ${phi}; d = ${egcdInv(e, phi)}; m = c^d mod n = ${m}.`,
          flag: flag(String(m)),
        };
      }
    },
    solve(lv) {
      const [n, e, c] = lv.artifacts.map((a) => BigInt(a.match(/\d+/)[0]));
      let p = 2n;
      while (n % p) p++;
      const d = egcdInv(e, (p - 1n) * (n / p - 1n));
      return flag(String(modpow(c, d, n)));
    },
  },

  pinHash: {
    tier: 2,
    doc: "unsalted-hash",
    build() {
      const pin = String(randomInt(0, 10000)).padStart(4, "0");
      const h = createHash("sha256").update(pin).digest("hex");
      return {
        title: "Hashed PIN",
        statement: `A wallet app stores the user's 4-digit PIN as an unsalted SHA-256 hash of the four ASCII digits (leading zeros kept, e.g. "0042"). The stored hash is in the artifacts. Find the PIN. Answer ZKCTF{pin}.`,
        artifacts: [h],
        hints: ["There are only 10,000 PINs. Hash them all.", "A short script with any SHA-256 library finishes in well under a second."],
        walkthrough: `sha256("${pin}") = ${h}.`,
        flag: flag(pin),
      };
    },
    solve(lv) {
      const hits = [];
      for (let i = 0; i < 10000; i++) {
        const pin = String(i).padStart(4, "0");
        if (createHash("sha256").update(pin).digest("hex") === lv.artifacts[0]) hits.push(flag(pin));
      }
      return hits;
    },
  },

  jwtWeakSecret: {
    tier: 2,
    doc: "jwt-weak-secret",
    leakCheck: false,
    build() {
      const pool = [...WORDS].sort(() => randomInt(3) - 1).slice(0, 12);
      const secret = pick(pool);
      const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
      const payload = b64url(JSON.stringify({ sub: "player", role: "user" }));
      const sig = createHmac("sha256", secret).update(`${head}.${payload}`).digest("base64url");
      return {
        title: "Guessable JWT secret",
        statement: `A dApp backend signs session tokens with HS256 (HMAC-SHA256). A leaked config shows the developer picked the secret from a short list of words. The token and the candidate list are in the artifacts. Which word is the signing secret? Answer ZKCTF{secret}.`,
        artifacts: [`${head}.${payload}.${sig}`, `candidates: ${pool.join(", ")}`],
        hints: ["The signature is HMAC-SHA256(secret, header + \".\" + payload), Base64url-encoded.", "Compute it for each candidate and compare."],
        walkthrough: `HMAC-SHA256("${secret}", header.payload) matches the token signature.`,
        flag: flag(secret),
      };
    },
    solve(lv) {
      const [head, payload, sig] = lv.artifacts[0].split(".");
      return lv.artifacts[1]
        .replace("candidates: ", "")
        .split(", ")
        .filter((w) => createHmac("sha256", w).update(`${head}.${payload}`).digest("base64url") === sig)
        .map(flag);
    },
  },

  reentrancy: {
    tier: 3,
    doc: "reentrancy",
    build() {
      const d = randomInt(1, 10);
      const V = d * randomInt(4, 30) + randomInt(0, d);
      const k = randomInt(2, 12);
      const total = Math.min(Math.floor(V / d), k + 1) * d;
      return {
        title: "Re-entrant vault",
        statement: `A vault holds ${V} ETH in total, including ${d} ETH the attacker deposited. withdraw() reads amount = balances[msg.sender], checks the vault holds at least amount, sends amount to the caller, and only then sets balances[msg.sender] = 0. The attacker's receive() calls withdraw() again whenever the vault still holds at least ${d} ETH, but gas limits allow at most ${k} nested re-entries. How much ETH does the attacker receive in total? Answer ZKCTF{number}.`,
        artifacts: ["function withdraw() { uint a = balances[msg.sender]; require(address(this).balance >= a); payable(msg.sender).call{value: a}(\"\"); balances[msg.sender] = 0; }"],
        hints: ["The balance is zeroed only after the external call, so every nested call sees the full deposit.", "Count the first call plus the re-entries, and stop when the vault runs dry or the depth limit hits."],
        walkthrough: `Each call pays ${d} ETH. Calls = min(floor(${V} / ${d}), ${k} + 1) = ${total / d}, so ${total} ETH.`,
        flag: flag(String(total)),
      };
    },
    solve(lv) {
      const [V, d, k] = lv.statement.match(/holds (\d+) ETH in total, including (\d+) ETH.*at most (\d+) nested/).slice(1).map(Number);
      return flag(String(Math.min(Math.floor(V / d), k + 1) * d));
    },
  },

  vaultInflation: {
    tier: 3,
    doc: "erc4626-inflation",
    build() {
      const D = randomInt(1000, 100000);
      const v = randomInt(100, D);
      const shares = Math.floor((v * 1) / (1 + D));
      const assets = 1 + D + v;
      const out = Math.floor((assets * 1) / (1 + shares));
      return {
        title: "First depositor",
        statement: `An ERC-4626-style vault mints shares = floor(deposit × totalShares / totalAssets) and pays out floor(shares × totalAssets / totalShares) on redeem. It starts empty. The attacker deposits 1 wei (getting 1 share), then sends ${D} wei straight to the vault without minting shares. A victim then deposits ${v} wei. The attacker redeems their 1 share. How many wei does the attacker receive? Answer ZKCTF{number}.`,
        artifacts: ["shares = floor(deposit * totalShares / totalAssets)", "assets = floor(shares * totalAssets / totalShares)"],
        hints: ["After the donation totalAssets = 1 + donation while totalShares = 1.", "Work out the victim's shares (rounding down), then the attacker's share of all assets."],
        walkthrough: `Victim shares = floor(${v} × 1 / ${1 + D}) = ${shares}. Total assets ${assets}, total shares ${1 + shares}; attacker gets floor(${assets} × 1 / ${1 + shares}) = ${out}.`,
        flag: flag(String(out)),
      };
    },
    solve(lv) {
      const [D, v] = lv.statement.match(/sends (\d+) wei.*deposits (\d+) wei/).slice(1).map(Number);
      const shares = Math.floor(v / (1 + D));
      return flag(String(Math.floor((1 + D + v) / (1 + shares))));
    },
  },
};

const URL_RE = /https?:\/\//i;

/** Problems with a generated level; empty means it is safe to publish. */
export function checkLevel(type, lv) {
  const out = [];
  if (!FLAG_RE.test(lv.flag) || Buffer.byteLength(lv.flag) > 32) out.push(`bad flag ${lv.flag}`);
  const got = [].concat(TYPES[type].solve(lv));
  if (got.length !== 1) out.push(`expected one answer, solver found ${got.length}`);
  else if (got[0] !== lv.flag) out.push(`solver got ${got[0]}, expected ${lv.flag}`);
  const visible = [lv.statement, ...lv.artifacts, ...lv.hints].join("\n").toLowerCase();
  if (visible.includes(lv.flag.toLowerCase())) out.push("full flag visible");
  const b = body(lv.flag);
  if (TYPES[type].leakCheck !== false && !/^\d+$/.test(b) && visible.includes(b)) out.push("answer visible");
  if (URL_RE.test(visible)) out.push("contains a URL");
  return out;
}

/** One level per tier (0 → 3, easiest first), never repeating a type from `avoid` when there is a choice. */
export function buildRound({ count = 4, avoid = [] } = {}) {
  const levels = [];
  for (let tier = 0; levels.length < count; tier = Math.min(tier + 1, 3)) {
    const used = levels.map((l) => l.type);
    const all = Object.keys(TYPES).filter((t) => TYPES[t].tier === tier && !used.includes(t));
    const fresh = all.filter((t) => !avoid.includes(t));
    const pool = fresh.length ? fresh : all.length ? all : Object.keys(TYPES).filter((t) => !used.includes(t));
    const type = pick(pool);
    for (let tries = 0; ; tries++) {
      const lv = TYPES[type].build();
      const problems = checkLevel(type, lv);
      if (levels.some((l) => l.flag === lv.flag)) problems.push(`duplicate flag ${lv.flag}`);
      if (!problems.length) {
        levels.push({ ...lv, type, doc: TYPES[type].doc });
        break;
      }
      if (tries > 50) throw new Error(`${type}: ${problems.join("; ")}`);
    }
  }
  return levels.map((l, id) => ({ ...l, id }));
}

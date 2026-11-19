# ZKCTF Dynamic Track (Poseidon) — spec v1

Status: design with a measured prototype (`circuits/prototypes/`). No program, backend or production circuit changes yet.
The static track (keccak256, `protocol/zkctf.md`) is unchanged.

## 0. Decisions (final for v1)

| Topic | Decision | Basis |
|-------|----------|-------|
| Hash | Poseidon over BN254 `Fr`, x^5, circomlib `Poseidon(n)` (not `PoseidonEx`) | §1 |
| Reference | Poseidon paper + `generate_parameters_grain.sage` as instantiated by iden3 circomlib 2.0.5 | §1 |
| Flag format | Keep the existing semantic format `ZKCTF{[a-z0-9_-]{1,25}}`; **no** `word-hex` hybrid | §4 |
| Secret salt `δ` | **Kept** (secret, per instance). Dropping it is only safe for ≥ 100-bit flags | §4 |
| Prover | Backend (as today), because `δ` is secret | §7 |
| Commitment lock | Poseidon-Merkle root of per-level leaves, frozen at `active_start` | §5 |
| Free track | Same puzzles, entry 0, no payout | §9 |

Correction to the earlier draft: it proposed dropping `δ` because "dynamic flags should not be low-entropy". The current generator's flags *are* low-entropy by design (§4), so that reasoning does not hold for v1.

## 1. Poseidon: reference, parameters, evidence

**Named reference**
- Paper: Grassi, Khovratovich, Rechberger, Roy, Schofnegger, "Poseidon: A New Hash Function for Zero-Knowledge Proof Systems", USENIX Security 2021 (ePrint 2019/458).
- Parameter generation: `generate_parameters_grain.sage` from the authors' `hadeshash` repository (IAIK, TU Graz). iden3 documents its use as
  `sage generate_parameters_grain.sage 1 0 254 <t> 8 <R_P> 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001`
- Instantiation we use: **iden3 circomlib 2.0.5** (`circuits/poseidon.circom`, `circuits/poseidon_constants.circom`).

**Parameters** (state width `t = arity + 1`; field `Fr = 21888242871839275222246405745257275088548364400416034343698204186575808495617`; S-box `x^5`; `R_F = 8`)

| Arity | t | R_P | Used for | Constraints (measured, circom 2.2.2) |
|-------|---|-----|----------|--------------------------------------|
| 2 | 3 | 57 | Merkle node | 240 |
| 4 | 5 | 60 | commitment `h` | 297 |
| 5 | 6 | 60 | leaf | ≈ 312 (derived from totals) |
| 6 | 7 | 63 | player commitment `C` | 354 |

Full `R_P` table by `t = 2..13`: 56, 57, 56, 60, 60, 63, 64, 63, 60, 66, 60, 65.

**Evidence collected (reproducible)**
- `poseidon_constants.circom` and `poseidon.circom` in `circuits/node_modules/circomlib` (2.0.5) are byte-identical to iden3 `master` and tag `v2.0.5`:
  - `poseidon_constants.circom` sha256 `94c9e4b5ea891ab4d1ba626f1d719f8c661014d9b628f6096c803f75f39e3eee`
  - `poseidon.circom` sha256 `2582464669b69827164bd08ee0337997e1957f2ab4f00cdd86d533ca5e9d9234`
- Three independent implementations agree:
  - circomlib circuit (circom 2.2.2, witness from the compiled wasm),
  - circomlibjs 0.1.7,
  - light-poseidon 0.4.1 (`Poseidon::new_circom`), the library behind Solana's `sol_poseidon`.
- Agreeing vectors for inputs `[1..n]`:
  - n=2: `0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a`
  - n=4: `0x299c867db6c1fdd79dcefa40e4510b9837e60ebb1ce0663dbaa525df65250465`
  - n=6: `0x2d1a03850084442813c8ebf094dea47538490a68b05f2239134a4cca2f6302e1`
- Arity 5 (the leaf) is covered by the prototype test (JS-computed leaf accepted by the circuit); it was not cross-checked against Rust.
- Not done: regenerating the constants from the sage script myself. The constants are trusted through the source above and the cross-implementation agreement.

**Solana**: the `sol_poseidon` syscall implements the same parameter set (BN254, x^5, widths 2..13, 1..12 inputs, big-endian, inputs < modulus). Feature `enable_poseidon_syscall` (`FL9RsQA6TVUoh5xJQ9d936RHSebA1NLQqe3Zv9sXZRpr`): mainnet-beta epoch 644, testnet 663, devnet 719 (per Vortex feature page; confirm with a test program before relying on it on-chain).

**Security status** (checked Nov 2026): the paper's recommended `R_F=8` with `R_P` of 57 (t=3) and 60 (t=5) carry +2 full rounds and +7.5% partial rounds over the then-known attack thresholds. The Ethereum Foundation cryptanalysis work (2024–2026) targets other instances (Poseidon2, KoalaBear); the reported 28-of-31-round attack is on a reduced KoalaBear instance. I found no published attack on the recommended BN254 x^5 round counts. Re-check before mainnet.

## 2. Static track check: keccak output vs `Fr`

Resolved, no issue. `circuits/relation.circom` splits each 256-bit keccak output into two 16-byte big-endian limbs (`Bytes16BE`), `hHi/hLo`, `cHi/cLo`, and the player key into `pHi/pLo`. Each limb is < 2^128 < `Fr`, so all six public inputs are canonical. Cost: ~305k non-linear constraints (`circuits/README.md`).

## 3. Encoding rules for Poseidon inputs

- Every input must be a canonical field element (< `Fr`). A raw 32-byte value may exceed `Fr`, so never pack 32 bytes into one element.
- 32-byte values (player key, flag after `pad32`): two 16-byte big-endian limbs `(hi, lo)`, as in `Bytes16BE`. Injective, each < 2^128.
- `δ` and the player nonce `n`: 31 random bytes read as one big-endian element (< 2^248 < `Fr`).
- Domain tags are the first input: `DOM_H = 1`, `DOM_C = 2`, `DOM_LEAF = 3`. Merkle nodes use plain `Poseidon(2)`.
- `pad32` stays: flag bytes right-padded with zeros to 32 (`FLAG_LEN = 32`), identical to `backend/src/relation.mjs`.

Definitions (level `i`, player `P`):
```
h_P,i  = Poseidon(DOM_H, s_hi, s_lo, δ_P,i)                  arity 4
leaf   = Poseidon(DOM_LEAF, P_hi, P_lo, i, h_P,i)            arity 5
C      = Poseidon(DOM_C, P_hi, P_lo, s_hi, s_lo, n)          arity 6
```

## 4. Flag format and `δ`

**Why `δ` stays.** `backend/src/ctfgen.js` builds flags that a human can recognise as correct: `FLAG_RE = /^ZKCTF\{[a-z0-9_-]{1,25}\}$/`, and e.g. the Caesar type uses two words from a 35-word list: 35 × 34 = 1190 ordered pairs ≈ **10.2 bits**. Official seeds such as `ZKCTF{4}` have fewer. A commitment without a secret salt over such a space is broken instantly. Measured: an unsalted Poseidon commitment of a two-word flag was recovered in **122 tries / 44 ms**.

In the Merkle design `h_P,i` is not public, but the published root plus the player's own authentication path still acts as an offline guessing oracle for that player's instance. A secret per-instance `δ` that never reaches the player closes this.

**Why not `kelime-hex`.** A hex suffix does not give human self-verification (the player cannot tell a correct decode) and, with `δ` in place, adds nothing for security. If the suffix is found in the artifact it is not secret; if it must be derived by solving, many puzzle types cannot embed it.

**v1.** Semantic flags as today, `δ_P,i` secret, derived off-chain: `δ_P,i = HMAC-SHA256(seed_R, "zkctf/delta" ‖ P ‖ i)[0..31]` (31 bytes). Poseidon is used only where the circuit or program must recompute it; secret derivation stays HMAC.

**v2 (player-side prover, no backend trust).** Possible only if the committed secret has ≥ 100 bits of entropy. A 25-character base32 token carries 125 bits; reserving one check character for human self-verification leaves ~120 bits. This restricts the puzzle families to those whose solution is a decodable token, and needs a new generator. Not part of v1.

## 5. Registration tree (locked at `active_start`)

- One leaf per `(player, level)` (§3). Tree: Poseidon-Merkle, fixed depth `D`, `2^D ≥ max_registrants × level_count`.
- Instances are generated at registration (they must exist to produce `h_P,i`), stored by the backend, and **revealed to the wallet only after `active_start`**.
- `root_R` is written once when registration closes and then frozen. No instruction may change it while `now < active_end` or after entries exist.
- The current program's `create_round` can overwrite commitments during a live round (same `start/end`, `lib.rs` 257–266). The dynamic track must not inherit that path.
- Constraint: registration must end before `active_start`. The weekly race today lets players enter during the live window; the dynamic track needs an entry cutoff (product decision, §10).

## 6. Relation and measured prototype

Public: `root, C, pHi, pLo, level` (5 inputs; the static circuit has 6).
Witness: `sHi, sLo, δ, n, idxBits[D], sib[D]`.

Statements: `h = Poseidon(DOM_H, sHi, sLo, δ)`; `leaf = Poseidon(DOM_LEAF, pHi, pLo, level, h)`; `leaf` opens to `root` along the path; `C = Poseidon(DOM_C, pHi, pLo, sHi, sLo, n)`.

Prototype: `circuits/prototypes/dynamic_relation.circom` (circom 2.2.2, `--O2`, circomlib 2.0.5):

| Depth `D` | Max leaves | Non-linear constraints |
|-----------|-----------|------------------------|
| 4 | 16 | 1,931 |
| 11 | 2,048 | 3,625 |
| 14 | 16,384 | 4,351 |
| 16 | 65,536 | 4,835 |

Static keccak circuit: ~305k. At `D = 14` the dynamic circuit is about 70× smaller (the ratio compares two different relations; it is not a like-for-like benchmark of the hash alone).

Test (`dynamic_relation.test.cjs`, depth 4): the correct witness is accepted; wrong flag, wrong `δ`, wrong player, wrong level and wrong root are each rejected.

Not done in the prototype: no range checks on limbs (the hash binding makes them unnecessary for soundness; the on-chain verifier must still reject non-canonical public inputs), no zkey/Groth16 setup, no proof timing.

Reproduce (from `circuits/`):
```
echo 'pragma circom 2.0.0; include "prototypes/dynamic_relation.circom"; component main {public [root, C, pHi, pLo, level]} = DynRelation(4);' > prototypes/dyn4.circom
circom prototypes/dyn4.circom --r1cs --wasm --O2 -o build-proto -l node_modules -l .
npm i --no-save circomlibjs@0.1.7      # test dependency only
node prototypes/dynamic_relation.test.cjs
```
(`prototypes/dyn4.circom` is a throwaway wrapper; `build-proto` is already covered by `circuits/build-*` in `.gitignore`.)

## 7. Who proves

v1: the backend proves, as the weekly race does today (`backend/src/prove.js`). The player submits the answer to the backend over the authenticated wallet session; the backend knows `s`, `δ`, `n` and produces the Groth16 proof. Trust assumption: the backend does not leak `s` or `δ`, and does not cheat. The proof still binds `P`, so a leaked proof is useless to others.

Player-side proving needs v2 (§4).

## 8. On-chain changes (outline)

- `Ctf` gains `mode: { Static, Dynamic }` and `registration_root: [u8; 32]`.
- `lock_root(root)`: maker only, `now ≥ registration_end`, root currently zero, writes once.
- New Groth16 verifying key for the dynamic circuit; separate trusted setup per circuit. The current phase 2 used one local beacon contribution (`circuits/README.md`): run a multi-party phase 2 before mainnet.
- Public input layout: `[root, C, pHi, pLo, level]`, all canonical.
- `sol_poseidon` is available if the program needs to recompute a leaf or node; not required by v1.

## 9. Tracks and anti-sharing

- Paid track: 0.05 SOL entry, dynamic instances, pot as today. Define a refund rule for broken puzzles before launch.
- Free track: same dynamic puzzles, entry 0, **no payout** (leaderboard/prestige only). Free plus payout invites sybil farming.
- Residual leak: a player can post their own riddle; another player can solve it (time advantage) but cannot submit the first player's flag, because their proof binds their own `P`, level and leaf. Mitigations: `last_solve_ts` gaps and flags for solve bursts within seconds.
- Announcements: rules, dates, link and fee only. Never puzzle content or answers; instances are shown only to registered wallets after `active_start`.

## 10. Open items

1. Entry cutoff for the weekly race (needed by §5).
2. Seeded generation vs persistence: `ctfgen.js` uses `randomInt` (not seedable). Either persist each `(round, P, i)` instance or refactor to a seeded DRBG. Persist is simpler; it adds backup requirements.
3. Per-player generation cost (`build()` plus independent `solve()` per level and player).
4. Maximum registrants (fixes `D`).
5. Refund rule for broken puzzles.
6. Multi-party phase 2 for the dynamic circuit before any mainnet use.
7. Re-check Poseidon cryptanalysis status before mainnet.

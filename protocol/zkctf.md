# ZK-CTF

A player types a flag. The site proves "this flag is correct and belongs to this wallet". The chain never sees the flag text.

What follows is the implementation spec (hash, witness, Groth16). For player-facing text see `README.md`.

Shared opening knowledge of two hash commitments.
Prover offline, verifier **online**. No Pedersen. π is not a hash.

This file has no LaTeX; formulas are plain Unicode (readable in any editor).

---

## 0. Alphabet

    H : {0,1}*  →  {0,1}²⁵⁶     (keccak256)

Concatenation  ∥  (not bitwise OR).
Salts are independent: expect  δ ≠ n ; no equality is required.

| Symbol | Kind    | Meaning                                    |
|--------|---------|--------------------------------------------|
| s      | private | solution                                   |
| δ      | private | create salt                                |
| n      | private | player salt                                |
| c      | private | answer the player typed; claim c = s       |
| P      | public  | player identity (pubkey / address)         |
| h      | public  | create commitment                          |
| C      | public  | player commitment                          |
| pk, vk | setup   | proving / verification key                 |
| π      | proof   | Groth16 seal (curve points)                |

---

## 1. Statement, witness, relation

Public statement:

    x  =  (h, C, P)  ∈  {0,1}²⁵⁶ × {0,1}²⁵⁶ × 𝒫

Witness:

    w  =  (s, δ, n)

NP relation — only this:

    ℛ(x, w)  ⟺  h = H(s ∥ δ)  ∧  C = H(P ∥ s ∥ n)
                    └── St₁ ──┘     └──── St₂ ────┘

The player builds C as:

    C  =  H(P ∥ c ∥ n)

Under collision resistance:

    St₂  ⟹  c = s

St₂ does not contain δ. St₁ does not contain n.
The only shared coordinate is **s**.

The verifier never runs H on s, δ, n. The check is on π.

---

## 2. Setup(1^λ)

Once, before deploy.

    Circuit 𝒞_ℛ : private wires s, δ, n ; public wires h, C, P ; St₁ ∧ St₂.

    (pk, vk)  ←  Groth16.Setup(𝒞_ℛ)

- vk → verifier program (online)
- pk → prover machine (offline). It does not contain s.

---

## 3. Create — proposer (offline → chain)

Input: s. Sample  δ ← {0,1}²⁵⁶.

    h  ←  H(s ∥ δ)

Only h is written on-chain.
At this point the proposer knows s; the chain does not. No π.

If you want the player to be the prover, δ is public (domain separation).
If δ stays secret, Prove runs with the same algorithm on the backend.

---

## 4. Play — player commitment (offline → chain)

Input: c, P. Sample  n ← {0,1}²⁵⁶.

    C  ←  H(P ∥ c ∥ n)

Sent on-chain: C. Kept offline: c, n.

---

## 5. Prove(pk, x, w) — offline

Input:  pk,  x = (h, C, P),  w = (s, δ, n)  with  s := c.

1. Wires: s, δ, n, h, C, P.
2. Circuit:

       h'  ←  H(s ∥ δ)
       C'  ←  H(P ∥ s ∥ n)

3. Constraint:  h' = h  and  C' = C.
   If c ≠ s or a salt is wrong, the assignment is outside ℛ and there is no π.
4.

       π  =  (A, B, D)  ∈  G₁ × G₂ × G₁
       π  ←  Groth16.Prove(pk, x, w)

A, B, D are three curve points (the seal). They are not hashes.

Note: papers also call the third point "C". We call it D; otherwise it
clashes with the player commitment C = H(P ∥ s ∥ n).

    C            ≠    D
    └── 256-bit hash (public statement)
                      └── G₁ point (third part of the proof)

The old notation was C_π. The subscript π was not an exponent, an indexed hash,
or the C of St₂; it was only a "C from the proof" label. No cryptographic
content; just a name clash.

Output: π = (A, B, D).
Not output: s, δ, n, or H(s ∥ n).
π ≠ H(·).

---

## 6. Verify(vk, x, π) — online

What the verifier sees:

    vk ,   x = (h, C, P) ,   π

What it does not see: s, δ, n.

    Verify(vk, x, π)  =  1     if the Groth16 pairing holds and π is well-formed
                      =  0     otherwise

Schematic pairing (L(x) uses only public h, C, P):

    e(A, B)  ≟  e(α, β) · e(L(x), γ) · e(D, δ_vk)

The program does not compute H(P ∥ s ∥ n).
Verify = 1  ⇒  ∃ w  ℛ(x, w)  (knowledge soundness), and π does not carry w.

---

## 7. Who holds what

|        | Setup  | Create | Prove          | Verify     |
|--------|--------|--------|----------------|------------|
| pk     | prover |        | uses           | no         |
| vk     | chain  |        | no             | **online** |
| h      |        | writes | reads          | reads      |
| C, P   |        |        | produces / reads | reads    |
| s, δ, n|        | s, δ   | **only here**  | no         |
| π      |        | no     | produces       | checks     |

---

## 8. Three theorems (summary)

Completeness.
If c = s and (δ, n) are correct:

    Verify( vk,  x,  Prove(pk, x, w) )  =  1

Knowledge soundness.
Verify(vk, x, π) = 1  ⇒  an extractor recovers w.
A forged π with c ≠ s does not pass.

Zero-knowledge.
A simulator produces a π-indistinguishable distribution from x alone; w is not needed.

---

## 9. One round

    proposer:   h = H(s ∥ δ)
        →
    player:     C = H(P ∥ c ∥ n)
        →
    offline:    π  ←  Prove(pk, x, w)
        →
    online:     Verify(vk, h, C, P, π)

n and δ stay separate. The proof is not H(s ∥ n).

---

## 10. π = (A, B, D) ∈ G₁ × G₂ × G₁  — exactly what it is

There are two layers. Do not mix them.

    your relation ℛ        bitwise keccak,  h = H(s ∥ δ) ∧ C = H(P ∥ s ∥ n)
    Groth16 envelope       turns ℛ into a proof object; polynomials appear here

No polynomial is written inside ℛ. A, B, D are not your hashes.

### 10.1  G₁, G₂ are groups, not generators

A pairing-friendly curve over BN254 (Ethereum Groth16).

    G₁  =  r-torsion (prime-order subgroup) of E(𝔽_p)
    G₂  =  sibling subgroup on the twisted curve
    G_T =  target group (multiplicative)

    e : G₁ × G₂  →  G_T     bilinear, non-degenerate pairing

Each group has a generator; the group itself is not a generator:

    G   ∈ G₁    (generator)
    ℋ   ∈ G₂    (generator)

Scalar notation (standard):

    [x]₁  :=  x · G     ∈ G₁
    [x]₂  :=  x · ℋ     ∈ G₂

A, B, D are not these generators; they are **points** of the form  x·G .
x is an 𝔽_r element derived from the witness and setup secrets.

### 10.2  Where the polynomials live (QAP)

Circom/snarkjs compiles the circuit to R1CS and R1CS to a QAP. You do not write it.

Over constraint indices:

    u_i(X), v_i(X), w_i(X)     Lagrange / interpolation polynomials
    t(X)                       target; zero at the constraint roots

Witness assignment (a_i) — contains public (h, C, P) and private (s, δ, n) wires:

    𝒜(X)  =  Σ_i a_i u_i(X)
    ℬ(X)  =  Σ_i a_i v_i(X)
    𝒞(X)  =  Σ_i a_i w_i(X)

The circuit is satisfied  ⟺

    𝒜(X) ℬ(X)  −  𝒞(X)  =  q(X) t(X)

Here q is the **quotient polynomial**. Not keccak H. Name clash.

The trusted setup picks a secret τ (toxic waste) and puts [τ^k]₁, [τ^k]₂ in the CRS.
The prover does not know τ; using the CRS it produces 𝒜(τ), ℬ(τ), 𝒞(τ), q(τ)
**as curve points** (evaluation-as-point). τ is never revealed.

### 10.3  Shape of A, B, D

The prover draws random r, s ← 𝔽_r (ZK blinding; not your salts δ, n).
With the Groth16 CRS values α, β, γ, δ_crs (δ_crs ≠ create salt δ):

    A  =  [  α + 𝒜(τ) + r δ_crs  ]₁     ∈ G₁
    B  =  [  β + ℬ(τ) + s δ_crs  ]₂     ∈ G₂
    D  =  [  (witness terms + q(τ) t(τ) + r,s blinding) / δ_crs  ]₁
                                                             ∈ G₁

Exact coefficients follow the Groth 2016 CRS; this is the idea.

- A: left wing 𝒜(τ), in G₁, blinded by r
- B: right wing ℬ(τ), in G₂, blinded by s (the other side of the pairing)
- D: balance / quotient + private wires, in G₁
      (called C in the paper; D here to avoid clashing with hash C)

None of them is a keccak output. None of them is the generator G itself.

Verifier:

    e(A, B)  ≟  e([α]₁, [β]₂) · e(L(x), [γ]₂) · e(D, [δ_crs]₂)

L(x) uses only the public x = (h, C, P). The pairing checks the identity
𝒜(τ)ℬ(τ)−𝒞(τ)=q(τ)t(τ) without revealing τ or the witness.

### 10.4  Name clashes

| Letter   | In this protocol       | In Groth16                    |
|----------|------------------------|-------------------------------|
| C        | player hash            | third proof point in paper    |
| D        | third proof point      | —                             |
| δ        | create salt            | CRS scalar δ_crs              |
| H        | keccak                 | sometimes quotient polynomial |
| G₁, G₂   | curve groups           | not generators                |
| G, ℋ     | generator points       | [1]₁, [1]₂                    |


---

## 11. The curve is not secp256k1 — BN254 (alt_bn128), pk / vk

### 11.1  Three separate curve jobs

secp256k1 is not a pairing group; Groth16 does not use it.

    P (player identity)    Ed25519 pubkey on Solana (secp256k1 → address on Ethereum)
                           in the circuit it is only 𝔽_r numbers,
                           not a G₁ / G₂ point

    π, pk, vk              BN254  (Circom/snarkjs name: bn128, alt_bn128)
                           Solana alt_bn128 syscalls; EVM precompiles EIP-196 / EIP-197

    (alternative, not this stack)  BLS12-381 — Ethereum consensus / EIP-2537
                           not the Circom Groth16 default

### 11.2  Pairing curves (full)

BN parameter  x = 4965661367192848881.
Embedding degree k = 12. CM discriminant −3, j = 0.

Base field and scalar field (both 254-bit primes, not equal):

    p  = 21888242871839275222246405745257275088696311157297823662689037894645226208583
    r  = 21888242871839275222246405745257275088548364400416034343698204186575808495617

    p  = 36x⁴ + 36x³ + 24x² + 6x + 1
    r  = 36x⁴ + 36x³ + 18x² + 6x + 1     (group order)

G₁ — the base curve, over 𝔽_p:

    E :  Y²  =  X³ + 3
    G  =  (1, 2)     generator, order r
    G₁ = E(𝔽_p)[r] = E(𝔽_p)     (cofactor 1 for BN)

G₂ — D-type sextic twist, over 𝔽_{p²}:

    𝔽_{p²}  =  𝔽_p[u] / (u² + 1)
    ξ       =  9 + u
    E′ :  Y²  =  X³ + 3/ξ  =  X³ + 3/(9+u)

    concrete b = 3/ξ:
      19485874751759354771024239261021720505790618469301721065564631296452457478373
      +  266929791119991161246907387137283842545076965332900288569378510910307636690 · u

    G₂ ⊂ E′(𝔽_{p²})[r]     cofactor c₂ = p + t − 1 ≠ 1

G_T — target:

    tower:
      𝔽_{p²}  = 𝔽_p[u]/(u²+1)
      𝔽_{p⁶}  = 𝔽_{p²}[v]/(v³ − (9+u))
      𝔽_{p¹²} = 𝔽_{p⁶}[w]/(w² − v)

    e : G₁ × G₂ → G_T ⊂ 𝔽_{p¹²}^×     optimal Ate pairing

G₁ point: (x,y) ∈ 𝔽_p² , 64 bytes uncompressed.
G₂ point: (x,y) ∈ 𝔽_{p²}² i.e. four 𝔽_p, 128 bytes.
π = (A, B, D) ≈ 64+128+64 = 256 bytes.

### 11.3  vk breakdown  (on-chain, small)

Groth16 verification key = the verifier slice of the CRS.
snarkjs verification_key.json:

    vk = (
      [α]₁ ,          vk_alpha_1     ∈ G₁
      [β]₂ ,          vk_beta_2      ∈ G₂
      [γ]₂ ,          vk_gamma_2     ∈ G₂
      [δ_crs]₂ ,      vk_delta_2     ∈ G₂
      IC[0..ℓ]        IC             ∈ G₁^{ℓ+1}
    )

ℓ = number of public inputs. h, C, P are 256 bits each and do not fit in 𝔽_r,
so each is split into two 128-bit limbs (`circuits/relation.circom`):

    x  =  (hHi, hLo, cHi, cLo, pHi, pLo)     ⇒  ℓ = 6,  |IC| = 7

    IC[i]  =  [  (β u_i(τ) + α v_i(τ) + w_i(τ)) / γ  ]₁     i = 0,…,ℓ

Public linear combination (the program computes this):

    L(x)  =  IC[0]  +  Σ_{i=1..6}  x_i · IC[i]     ∈ G₁

On-chain (`verify_groth16` in `programs/zkctf/src/lib.rs`): 6 `alt_bn128_multiplication`
+ 6 `alt_bn128_addition` for L(x), then one 4-pair `alt_bn128_pairing`:

    e(−A, B) · e([α]₁, [β]₂) · e(L(x), [γ]₂) · e(D, [δ_crs]₂)  =  1

−A is negated off-chain by the prover (`circuits/scripts/prove.mjs`).
vk contains no witness, no τ, no s. It is circuit-specific and changes after every setup.

### 11.4  pk breakdown  (at the prover, large)

Proving key = the full CRS σ (Groth 2016). τ, α, β, γ, δ_crs are toxic waste and
must be destroyed after setup. pk holds their point forms:

    pk ⊃ vk and also:

    [α]₁, [β]₁, [β]₂, [γ]₂, [δ_crs]₁, [δ_crs]₂

    { [τ^i]₁ }          i = 0 … n−1         n = number of constraints
    { [τ^i]₂ }          i = 0 … n−1

    { [u_i(τ)]₁ }       i = 0 … m            A-query (all wires)
    { [v_i(τ)]₁ }       i = 0 … m            B-query G₁
    { [v_i(τ)]₂ }       i = 0 … m            B-query G₂

    { [(β u_i(τ)+α v_i(τ)+w_i(τ))/δ_crs]₁ }   i = ℓ+1 … m
                                              private K-query (builds D)

    { [τ^i t(τ)/δ_crs]₁ }  i = 0 … n−2        H-query (quotient q(τ))

snarkjs .zkey stores these in binary (tens to hundreds of MB for a keccak circuit).
The prover builds A, B, D as sums of scalar multiplications with pk; it never knows τ.

    pk  =  CRS for Prove     (offline, large)
    vk  =  CRS for Verify    (online, small, in the program)

---

## 12. Official round economics (locked)

This section is separate from ℛ. The proof is the same. The gate and the prize live here.
The race is **USDC only**. No fiat. SOL is not the pot (gas only).

    ENTRY_ATOMS    =  5_000_000        // 5 USDC, 6 decimals
    N_WINNERS      =  10
    TREASURY_BPS   =  2_000            // 20% of the pot
    WEIGHTS        =  [2500, 1800, 1300, 1000, 800, 700, 600, 500, 400, 400]
                                       // 25%, 18%, … of the prize pool.  Sum 10_000
    WINDOW         =  Sat 15:00 UTC → +24h
                   =  18:00 Istanbul = 12:00 Buenos Aires

`enter_round`: player signature + 5 USDC transfer (player ATA → pot ATA).
Entry PDA (`entry` ∥ P). Does not charge twice in the same round.

`submit` does not require a Seat. `entry.round_start = round.start`.
There is no per-level PDA: `submit` sets bit `level` in `entry.solved_mask` and writes
`entry.last_ts = now`. Levels must be solved in order (bit `level` only if bits `0..level`
are set); a second submit of the same level fails. One Entry PDA per player per round.

Ranking, when the window closes:

    score(P)  =  popcount(entry(P).solved_mask)
    time(P)   =  entry(P).last_ts            // last verified submit

Ranking (linear CTF): only wallets that cleared **every** level are candidates.
Order: finish time ↑ (last solve timestamp).
k = min(N_WINNERS, |full clears|).

    pot        =  5e6 · entries
    treasury0  =  pot · 2000 / 10_000
    prize      =  pot − treasury0
    denom      =  Σ WEIGHTS[0..k)
    pay[i]     =  prize · WEIGHTS[i] / denom     i < k
    treasury   =  treasury0 + (prize − Σ pay)    // dust goes to treasury

k = 0 (nobody solved) → the whole pot goes to treasury.
k = 1 → that wallet gets 100% of prize (WEIGHTS renormalized);
treasury still takes 20%.
Even with k = 10 or 40 entries, only the first 10 receive pay[i].

`settle` (authority, round over): same `split_pot` function, pays USDC.
Code: `programs/zkctf/src/payout.rs`.

The Seat PDA (`["seat", wallet]`) is the **Academy membership**. It does not open the official round.
Checkout is one transaction built by the host and signed by the member: (1) create the treasury USDC ATA idempotently, (2) SPL `Transfer` of the plan price from the member's USDC ATA to the treasury ATA, (3) `mint_seat` co-signed by the config authority. The authority signature covers the whole message, so the seat cannot be minted without the transfer. Plans: 1 / 3 / 12 months at 10 / 27 / 90 USDC. `tier = 1` marks a **Founding member** (first `FOUNDING_SEATS` = 100 seats, counted on-chain with `getProgramAccounts` on seat size + tier byte). Founding members pay `FOUNDING_DISCOUNT_BPS` (50%) less on every renewal and see lessons `FOUNDING_EARLY_HOURS` (24h) early. `slots` / `prompts_used` are unused (0).
Academy lessons: weekly, two tracks (cybersecurity: reproduced real incidents; math for cybersecurity). AI drafts, a human editor reviews and publishes (`scripts/lesson.mjs`), content lives in `content/lessons/published/`. Lesson flags are checked off-chain by the host.

### 12.1 Prestige and scope (locked)

- Prestige: wallet-bound **season points** (off-chain host; PDA later). Non-transferable; does not change the weekly USDC `split_pot` formula.
- Transferable reward tokens / cutting a fixed % from the pot via staking are out of scope for this version.
- Pitch (dual): pay-to-submit 50–100 vs 5 in the pot **+** the flag is never on-chain (Groth16). The category pitch is not "Solana CTF app".
- Source of prizes / ranking: only on-chain `submit` verify + `settle`/`split_pot`. Off-chain score is not payout.
- Host `solves.json` / `/progress` = unlock index; settle winners = Entry PDAs with a full `solved_mask` (`rankClearsOnChain`). Board credit: `/confirm-solve` after the Groth16 tx.
- No UGC challenge marketplace (v1). Academy lessons and membership never write to the official board / pot.
- Structural lock table: repo root `STRUCTURAL_LOCKS.md` (business plan §1.3 A–G).
- USDC mint (devnet): `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. `enter_round` checks the mint. Pot ATA owner = `["pot"]` vault PDA.
- Weekly set: host `backend/data/round.json` + bot `scripts/weekly-challenge-bot.mjs`; on-chain `create_round` commitments.

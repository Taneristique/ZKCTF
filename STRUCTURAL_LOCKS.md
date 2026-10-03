# Structural locks (business plan §1.3 / v6.3)

Mandatory product omurga vs FlagWars / Capture The SOL. Soft pitch is not enough.

| # | Lock | Enforce |
| --- | --- | --- |
| **A** | Leaderboard + prize only via on-chain Groth16 `submit` | `programs/zkctf` `submit` + `settle`/`split_pot`; `settle-round.mjs` ranks from Entry `solved_mask` (set only by verified `submit`); `/confirm-solve` after tx; host `solves.json` is progress index, not payout source |
| **B** | Flag never in tx / events / logs | Circuit `ℛ`; UI proves locally; chain sees π + public `(h,C,P)` only |
| **C** | Payout = fixed `split_pot` (20% treasury / 80% top 10) | `payout.rs` only; no discretionary prize ix |
| **D** | One curated official set / week; no UGC marketplace | Host `weekly-challenge-bot` + `round.json`; no “create challenge” API for players |
| **E** | Academy never writes race board / pot | Lesson flags are checked off-chain; membership USDC goes to the treasury ATA, never the pot |
| **F** | Pitch = ZK proof-of-solve + pot math — never “Solana CTF app” | `frontend/lib/copy.ts`, Docs, READMEs, layout metadata |
| **G** | No reward token / stake cut of pot | Already red in plan; do not add |

**Faz 0:** Shipping Play without A+B path is forbidden. Demo order: flag off explorer → verify tx → `split_pot` → (optional) Academy lesson + USDC membership 30s.

See also: Desktop `ZKCTF_Business_Plan.md` §1.3, `protocol/zkctf.md` §12.1.

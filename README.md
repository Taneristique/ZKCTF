# ZKCTF

ZKCTF is a platform for profitable on-chain capture-the-flag puzzles powered by Groth16. It targets a real problem in cybersecurity education: good training is expensive and rarely built on real incidents. ZKCTF offers affordable, high-quality lessons built from reproduced real-life hack cases.

- **Academy (weekly):** AI-assisted, human-reviewed lessons in **cybersecurity** and **math for cybersecurity**, published every week. Each security lesson rebuilds a real incident; each math lesson teaches the math that broke or protected a real system. Membership is paid in **USDC on-chain** (10 / 27 / 90 USDC for 1 / 3 / 12 months). **Founding members** (first 100 wallets) get 50% off for as long as they renew, a Founding badge, and 24-hour early access to lessons.
- **Saturday race:** 24 hours, Saturday 18:00 Istanbul = 12:00 Buenos Aires. **5 USDC** to enter. 20% treasury, 80% to the first 10 with a fixed table. The flag you type **never goes on-chain**: a Groth16 proof shows you solved it.
- **Pseudonym:** first-time players pick a public name (independent of Academy); the weekly board shows names, not only wallets.
- **Week-winner NFT:** after settle, top finishers get a **soulbound** Token-2022 badge for that week (transferable collections deferred).
- **Academy gift:** clear **3** full races (Finisher balance) → claim **1** free Academy month **once** per wallet (no USDC).

Not “another Solana CTF app.” Structural locks: [STRUCTURAL_LOCKS.md](STRUCTURAL_LOCKS.md).

- Play: weekly curated official puzzles after this week’s 5 USDC entry · on-chain `submit` + `split_pot`.
- Learn: `/learn` serves `backend/content/lessons/published/*.json`. Lessons and membership never write the race board or pot.
- **Ops (AI keys, weekly bot, USDC, deploy):** [docs/OPS.md](docs/OPS.md) — keep keypairs, PDA/ATA addresses, and host secrets out of this README.
- How it works: [frontend docs](frontend/components/DocsView.tsx) and [protocol/README.md](protocol/README.md).
- Implementer math: [protocol/zkctf.md](protocol/zkctf.md).

## Run

```bash
# API
cd backend && pnpm install && pnpm dev   # :8787

# Web
cd frontend && pnpm install && pnpm dev -p 3001  # :3001
# Preview next week's CTFs (generated + verified, nothing written)
cd backend && node ../scripts/weekly-challenge-bot.mjs --dry-run
# Generator tests: every flag is re-derived by an independent solver
cd backend && pnpm test
```

Copy `backend/.env.example` → `backend/.env` and set RPC, program id, USDC mint, and authority paths there — never commit real key material. Puzzles stay hidden until the round starts; local-only reveal flags belong in `.env`, not in production.

### Weekly bot

The API runs the weekly cycle itself (`backend/src/scheduler.js`, every 5 minutes): settle the finished round on chain, mint the Finisher token to everyone who cleared it, generate next week's CTFs, publish their commitments with `create_round`, and sync the Founding list. Every step reads chain state first, so restarts and retries are safe. `GET /zk-api/bot/status` shows the last run, errors, and recent history.

Each CTF comes from a puzzle type in `backend/src/ctfgen.js`, built on a documented vulnerability class (`backend/content/ctf-docs/index.json`, with CWE / SWC / RFC references shown to players). The answer is computed by code and re-derived from the player-visible data by a separate solver; a level is published only if that gives exactly one answer equal to the flag. `ANTHROPIC_API_KEY` (or OpenRouter) is optional and only adds a story intro, which is rejected if it contains digits, URLs or the answer.

The authority wallet pays settle and mint fees. Keep it funded; the bot warns when SOL is low (`BOT_MIN_SOL`). Exact balances, mint addresses, and keypair paths live in host env / [docs/OPS.md](docs/OPS.md).

```bash
cd backend && node ../scripts/loyalty-init.mjs        # once: prints LOYALTY_MINT
cd backend && node ../scripts/founders-snapshot.mjs   # first 100 buyers → snapshot file
cd backend && node ../scripts/settle-round.mjs        # manual settle, same code as the bot
```

For mainnet, set `FOUNDER_SNAPSHOT` to the exported snapshot: those wallets get the Founding price once, on their first purchase (their seat is a regular tier 0 seat, so renewals are at the full price), and keep the Founder badge. Devnet seats are paid with free faucet USDC, so a permanent mainnet discount would be easy to farm. Signed-but-unconfirmed Founding checkouts hold a seat briefly so two simultaneous buyers cannot both take the last one; the mainnet program should enforce the cap on chain from its first deploy.

### Publishing the weekly lessons (AI draft → human review → publish)

```bash
# 1. AI draft (needs ANTHROPIC_API_KEY; --blank for an empty template)
node scripts/lesson.mjs draft --track security --case "Wormhole 2022"
node scripts/lesson.mjs draft --track math --topic "ECDSA nonce reuse"
# 2. Edit backend/content/lessons/drafts/<file>.json: fact-check the case + sources, solve the exercise yourself
node scripts/lesson.mjs check backend/content/lessons/drafts/<file>.json
# 3. Publish under your name (optionally schedule with --at ISO-date; Founding members see it 24h earlier)
node scripts/lesson.mjs publish backend/content/lessons/drafts/<file>.json --editor "Your Name"
node scripts/lesson.mjs list
```

```bash
# Circuit (once; setup is long)
cd circuits && bash scripts/setup.sh
# writes programs/zkctf/src/verifying_key.rs

# Program — rustc 1.79 (matches Solana platform-tools / cargo-build-sbf).
cargo build-sbf --manifest-path programs/zkctf/Cargo.toml
solana program deploy target/deploy/zkctf.so --program-id target/deploy/zkctf-keypair.json
# Right after deploy: initialize + create_round (authority from backend/.env)
cd backend && node ../scripts/init-devnet.mjs && cd ..
# Create the pot USDC ATA for the pot vault PDA if missing (script prints the command).
```

**Play on Devnet:** Phantom → Devnet. Fund SOL from [faucet.solana.com](https://faucet.solana.com) and Circle Devnet USDC from [faucet.circle.com](https://faucet.circle.com/) (Solana Devnet). Program id and USDC mint are in `backend/.env.example` / the live `/zk-api/health` response — do not paste authority keypairs or vault ATAs into public docs.

Join → Enter (5 USDC) → Play. (`enter_round` rejects any other mint.)

```bash
node scripts/judge-loop.mjs
```

### Editor (rust-analyzer)

Install the recommended **rust-analyzer** extension (`.vscode/extensions.json`). `rust-toolchain.toml` pins rustc 1.79 for `cargo build-sbf` and installs the `rust-analyzer`, `rust-src`, `clippy` and `rustfmt` components. The editor runs rust-analyzer against toolchain 1.93.1 (`rustup toolchain install 1.93.1 -c rust-analyzer rust-src`), because the 1.79 proc-macro server is too old for current rust-analyzer releases.

## Deploy (Railway)

One service. The root `Dockerfile` builds both apps; `scripts/start.sh` runs the API on `127.0.0.1:8787` and Next.js on `$PORT`, which proxies `/zk-api` to the API inside the container.

- Root Directory: `/` (the root `Dockerfile` is auto-detected)
- Variables: set program id, RPC, USDC mint, treasury, and `ZKCTF_DATA_DIR=/data` on the **host secret store** (Railway Variables). Attach a volume at `/data` so profiles/entries survive redeploys. Confirm `/zk-api/health` → `dataPersistent: true` after deploy.
- Optional build-time public RPC / program id for the frontend (`NEXT_PUBLIC_*`)
- `FOUNDING_EXCLUDE`: comma-separated team/test wallets on the cloud service only (not in git)
- Weekly bot: `BOT_CHAIN=1` only on production; `LOYALTY_MINT`; optional alert webhook; `ANTHROPIC_API_KEY` for story intros / lesson drafts
- Authority key material (`AUTHORITY_KEYPAIR_JSON` or path) stays in host secrets only — never in the repo, README, or client bundles

`backend/Dockerfile` still builds the API alone if it ever needs its own service. Full checklist: [docs/OPS.md](docs/OPS.md).

## License

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).

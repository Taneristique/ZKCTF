# ZKCTF

ZKCTF is a platform for profitable on-chain capture-the-flag puzzles powered by Groth16. It targets a real problem in cybersecurity education: good training is expensive and rarely built on real incidents. ZKCTF offers affordable, high-quality lessons built from reproduced real-life hack cases.

- **Academy (weekly):** AI-assisted, human-reviewed lessons in **cybersecurity** and **math for cybersecurity**, published every week. Each security lesson rebuilds a real incident; each math lesson teaches the math that broke or protected a real system. Membership is paid in **USDC on-chain** (10 / 27 / 90 USDC for 1 / 3 / 12 months). **Founding members** (first 100 wallets) get 50% off for as long as they renew, a Founding badge, and 24-hour early access to lessons.
- **Saturday race:** 24 hours, Saturday 18:00 Istanbul = 12:00 Buenos Aires. **5 USDC** to enter. 20% treasury, 80% to the first 10 with a fixed table. The flag you type **never goes on-chain**: a Groth16 proof shows you solved it.

Not “another Solana CTF app.” Structural locks: [STRUCTURAL_LOCKS.md](STRUCTURAL_LOCKS.md).

- Play: weekly curated official puzzles after this week’s 5 USDC entry · on-chain `submit` + `split_pot`.
- Learn: `/learn` serves `backend/content/lessons/published/*.json`. Lessons and membership never write the race board or pot.
- **Ops (AI keys, weekly bot, USDC, deploy):** [docs/OPS.md](docs/OPS.md)
- How it works: [frontend docs](frontend/components/DocsView.tsx) and [protocol/README.md](protocol/README.md).
- Implementer math: [protocol/zkctf.md](protocol/zkctf.md).



## Run

```bash
# API
cd backend && pnpm install && pnpm dev   # :8787

# Web
cd frontend && pnpm install && pnpm dev -p 3001  # :3001
# New weekly official set (answers → backend/data/round.json)
cd backend && node ../scripts/weekly-challenge-bot.mjs
# Optional on-chain: CHAIN_DEPLOY=1 node ../scripts/weekly-challenge-bot.mjs
```

### Publishing the weekly lessons (AI draft → human review → publish)

```bash
# 1. AI draft (needs OPENROUTER_API_KEY=sk-or-…; --blank for an empty template)
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
# Right after deploy: initialize + create_round (authority = AUTHORITY_KEYPAIR in backend/.env)
cd backend && node ../scripts/init-devnet.mjs && cd ..
# Pot vault USDC account (script prints the exact command if missing)
spl-token create-account 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --owner 8GTsVAHxdNmF7swwv9191oojUcByqtoeKHKzTQoQUDQ6 -u devnet
```

Devnet deployment: program `34Kut3tQ4HTJMF2gVvnT6shhmenPE6463xnGk5sxDtz7`, round PDA `85gksERjbotjcxTsq1CnaxWxEFNTr9ZFK8fbLQoVJmT5`, pot USDC ATA `WRfM4bnfCbeJTABqJhR1furvuQCo1XT9yu7jCyUJNsU`.

Phantom **Devnet**, then fund the wallet:

1. **SOL (gas):** [faucet.solana.com](https://faucet.solana.com)
2. **USDC (entry):** program mint is Circle Devnet USDC
  `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`  
   Get it from [faucet.circle.com](https://faucet.circle.com/) → **Solana Devnet** → paste your wallet → request USDC (~20 USDC / 2h).  
   In Phantom: Devnet → token list → add mint above if USDC does not show.

Join → Enter (5 USDC) → Play. (`enter_round` rejects any other mint.)

```bash
node scripts/judge-loop.mjs
cd backend && TREASURY_USDC_ATA=... node ../scripts/settle-round.mjs
```

### Editor (rust-analyzer)

Install the recommended **rust-analyzer** extension (`.vscode/extensions.json`). `rust-toolchain.toml` pins rustc 1.79 for `cargo build-sbf` and installs the `rust-analyzer`, `rust-src`, `clippy` and `rustfmt` components. The editor runs rust-analyzer against toolchain 1.93.1 (`rustup toolchain install 1.93.1 -c rust-analyzer rust-src`), because the 1.79 proc-macro server is too old for current rust-analyzer releases.

## Deploy (Railway)

One service. The root `Dockerfile` builds both apps; `scripts/start.sh` runs the API on `127.0.0.1:8787` and Next.js on `$PORT`, which proxies `/zk-api` to the API inside the container.

- Root Directory: `/` (the root `Dockerfile` is auto-detected)
- Variables: `AUTHORITY_KEYPAIR_JSON`, `ZKCTF_PROGRAM_ID`, `SOLANA_RPC`, `USDC_MINT`, `TREASURY_WALLET`, `ZKCTF_DATA_DIR=/data`; optional build-time `NEXT_PUBLIC_SOLANA_RPC`, `NEXT_PUBLIC_PROGRAM_ID`
- Volume mounted at `/data`; custom domain `zkctf.com`

`AUTHORITY_KEYPAIR_JSON` is the keypair array (`[12,34,…]`); keep it only in the host's secret variables. `backend/Dockerfile` still builds the API alone if it ever needs its own service.

## License

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).


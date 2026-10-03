# ZKCTF ops guide — weekly lessons, weekly race, USDC membership, deploy

Plain-language runbook. Read this before wiring production keys.

---

## 1. What the product does

| Piece | Money | AI? |
| --- | --- | --- |
| **Saturday race** | **5 USDC** into an on-chain pot. After 24h, `settle` pays **20% treasury + 80% top 10**. | Optional: the weekly bot can ask OpenRouter for new puzzles. A human still checks them. |
| **Academy** | Membership in **USDC on-chain**: 10 / 27 / 90 USDC for 1 / 3 / 12 months. First 100 wallets are **Founding members** (50% off for as long as they renew, badge, 24h early access). | AI drafts lessons; a human editor reviews and publishes every lesson. |

Season points are wallet-bound progress markers. The weekly race pays only via the published USDC pot formula. Academy money never touches the race pot.

---

## 2. Fill `.env` (backend)

Copy `backend/.env.example` → `backend/.env`.

```bash
PORT=8787
PUBLIC_APP_URL=http://localhost:3001
SOLANA_RPC=https://api.devnet.solana.com
ZKCTF_PROGRAM_ID=34Kut3tQ4HTJMF2gVvnT6shhmenPE6463xnGk5sxDtz7

# Devnet Circle USDC (must match the program constant USDC_MINT)
USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
# Optional override; default = ATA of pot vault PDA ["pot"]
# POT_USDC_ATA=
# Treasury ATA that receives 20% on settle
# TREASURY_USDC_ATA=
ENABLE_CHAIN_ENTER=1
ROUND_WINDOW=open

# AI drafts for lessons + weekly puzzles (OpenRouter key: sk-or-…)
OPENROUTER_API_KEY=
OPENROUTER_MODEL=anthropic/claude-sonnet-4

# Program authority (initialize / create_round / settle / co-signs membership seats)
AUTHORITY_KEYPAIR=/home/you/.config/solana/zkctf-devnet.json

# Membership USDC goes to this wallet's USDC ATA (default: authority wallet)
# TREASURY_WALLET=
# FOUNDING_SEATS=100
# FOUNDING_DISCOUNT_BPS=5000
# FOUNDING_EARLY_HOURS=24
```

Without `AUTHORITY_KEYPAIR` the backend falls back to a keypair derived from a public seed (`backend/src/authority.js`). That is only for local demos; never deploy with it.

Frontend `frontend/.env.local` (copy `frontend/.env.example`):

```bash
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=34Kut3tQ4HTJMF2gVvnT6shhmenPE6463xnGk5sxDtz7
```

---

## 3. Weekly lessons (AI draft → human review → publish)

**Script:** `scripts/lesson.mjs`. **Content:** `content/lessons/published/*.json` (served), `content/lessons/drafts/` (never served).

```bash
node scripts/lesson.mjs draft --track security --case "Wormhole 2022"   # AI draft (or --blank)
node scripts/lesson.mjs draft --track math --topic "ECDSA nonce reuse"
# edit the draft: fact-check the incident + sources, solve the exercise yourself, fix wording
node scripts/lesson.mjs check content/lessons/drafts/<file>.json
node scripts/lesson.mjs publish content/lessons/drafts/<file>.json --editor "Your Name" [--at 2026-10-10T12:00:00Z]
node scripts/lesson.mjs list
```

- Tracks: `security` (a reproduced real incident, must have `case.name`, `case.date`, `case.sources`) and `math` (math for cybersecurity).
- `publish` refuses drafts with `TODO`, missing sources, a too-short body or a malformed flag, and requires `--editor`.
- `--at` schedules a lesson; Founding members see it `FOUNDING_EARLY_HOURS` before `publishedAt`.
- Lesson flags are checked off-chain by the API and never affect the race board or pot.
- Without an OpenRouter key, `draft` writes a blank template.

**Access control:** full lesson text and flag checks need an active on-chain seat **and** a wallet signature. The browser signs `ZKCTF Academy sign-in / wallet / expires` once a day (`frontend/lib/walletAuth.ts`); the API verifies the ed25519 signature (`backend/src/walletAuth.js`). Knowing a member's address is not enough.

---

## 4. Academy membership (USDC)

`POST /checkout { wallet, months }` builds one transaction that the member's wallet signs:

1. create the treasury USDC ATA (idempotent),
2. SPL transfer of the plan price → treasury ATA,
3. `mint_seat` co-signed by the authority (`tier = 1` for Founding, `0` otherwise).

The authority signature covers the whole message, so a seat can't be minted without the payment. The API simulates the transaction first and returns a clear error for "no USDC" / "no token account". Renewals extend from the current expiry. `GET /plans?wallet=` returns prices, Founding seats left and the wallet's status.

---

## 5. Weekly challenge bot (official race)

**Script:** `scripts/weekly-challenge-bot.mjs`

```bash
cd backend
node ../scripts/weekly-challenge-bot.mjs
# Also send create_round on-chain (needs SOL on authority + initialized config):
CHAIN_DEPLOY=1 node ../scripts/weekly-challenge-bot.mjs
```

- Without OpenRouter → rotates built-in beginner seeds.
- With OpenRouter → asks for 4 new puzzles, validates them, seals flags with keccak commitments.
- Cron idea (UTC): Saturday 14:50 ≈ 17:50 Istanbul, before 18:00 open:
  `50 14 * * 6 cd /path/ZKCTF && node scripts/weekly-challenge-bot.mjs`

---

## 6. Deploy the Solana program

```bash
solana config set --url https://api.devnet.solana.com
cargo build-sbf --manifest-path programs/zkctf/Cargo.toml
solana program deploy target/deploy/zkctf.so --program-id target/deploy/zkctf-keypair.json
cd backend && node ../scripts/init-devnet.mjs     # initialize + create_round, right after deploy
spl-token create-account 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --owner <pot vault PDA> -u devnet
```

Run `initialize` immediately after deploy: until then, anyone could claim the config authority.

### Circuit / Groth16 (for on-chain `submit`)

```bash
cd circuits && bash scripts/setup.sh
# exports programs/zkctf/src/verifying_key.rs — rebuild + redeploy after
```

Until the verifying key is real, the host accepts flags (`/prove-assist`) but on-chain `submit` fails verification.

---

## 7. Weekly race USDC path

| Instruction | What it does |
| --- | --- |
| `enter_round` | Player signs; transfers 5 USDC from player ATA → pot ATA. Checks mint, round PDA and pot ATA owner. Creates/updates the Entry PDA. |
| `submit` | Verifies the Groth16 proof and sets the level bit in `Entry.solved_mask` (linear order). |
| `settle` | After `end`, authority pays `split_pot`: 20% treasury ATA, 80% to up to 10 winner ATAs by fixed weights. |

After the window: `cd backend && TREASURY_USDC_ATA=… node ../scripts/settle-round.mjs`.

**Mainnet:** change program `USDC_MINT` to `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`, rebuild, redeploy, update `.env`.

---

## 8. Troubleshooting

### Frontend `pnpm dev` fails with “OS file watch limit”

Raise Linux inotify limits once:

```bash
sudo sysctl -w fs.inotify.max_user_watches=524288
sudo sysctl -w fs.inotify.max_user_instances=1024
```

### rust-analyzer “proc-macro panicked”

The repo pins rustc 1.79 for `cargo build-sbf`. `.vscode/settings.json` runs rust-analyzer with toolchain 1.93.1: `rustup toolchain install 1.93.1 -c rust-analyzer rust-src`.

---

## 9. Files map

| Path | Role |
| --- | --- |
| `backend/src/lessons.js` | Loads published lessons, access rules |
| `backend/src/membership.js` | Plans, Founding perk, USDC checkout tx |
| `backend/src/walletAuth.js` | Wallet signature check for member routes |
| `backend/src/roundStore.js` | Weekly official set + answers |
| `scripts/lesson.mjs` | Draft / check / publish lessons |
| `scripts/weekly-challenge-bot.mjs` | New weekly race set |
| `scripts/settle-round.mjs` | Pay USDC winners |
| `programs/zkctf/src/lib.rs` | enter / submit / settle / mint_seat |
| `programs/zkctf/src/payout.rs` | 5 USDC, 20/80, weights |
| `frontend/app/learn/page.tsx` | Academy UI |
| `frontend/app/play/page.tsx` | Race UI |

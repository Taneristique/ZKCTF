# ZKCTF, in plain words

ZKCTF builds profitable on-chain CTF puzzles powered by Groth16 and offers affordable cybersecurity education built on reproduced real-life hack cases.

Saturday race: **5 USDC**, no cards. 24 hours, 18:00 Istanbul = 12:00 Buenos Aires.

20% of the pot is treasury. The other 80% is paid to the first 10 on the board with a fixed declining table (25%, 18%, 13% …). If only two people solved, those two still use 25:18, scaled so they get the whole 80%. If nobody solved, treasury takes all. If forty entered, still only the first 10 are paid.

**Pitch:** (1) pay-to-submit fees elsewhere are often **50–100 USDC** with no refund; here **5 stays in the pot**. (2) Flag never hits the chain — Groth16 proof-of-solve. Season points stay on the wallet and do not change `split_pot`.

That formula lives in the Solana program (`payout.rs`) and in `settle`. Board credit in production requires on-chain `submit` verify.

Academy: every week we publish AI-assisted, human-reviewed lessons in cybersecurity (reproduced real-life hacks) and math for cybersecurity. Membership is paid in USDC on-chain (10 / 27 / 90 USDC for 1 / 3 / 12 months); the first 100 wallets are Founding members (50% off for as long as they renew, badge, 24h early access). The Academy does **not** enter the race board or pot. No UGC challenge marketplace in v1.

Structural locks A–G: [STRUCTURAL_LOCKS.md](../STRUCTURAL_LOCKS.md). Implementer spec: `zkctf.md` §12.

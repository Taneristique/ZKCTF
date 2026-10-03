#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana-test-validator --reset --quiet &
sleep 4
solana config set --url http://127.0.0.1:8899
solana airdrop 10
cargo build-sbf --manifest-path "$ROOT/programs/zkctf/Cargo.toml"
solana program deploy "$ROOT/target/deploy/zkctf.so" \
  --program-id 34Kut3tQ4HTJMF2gVvnT6shhmenPE6463xnGk5sxDtz7
echo "deployed. API: SOLANA_RPC=http://127.0.0.1:8899"

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="$HOME/.local/bin:$PATH"
OUT="$ROOT/build"
mkdir -p "$OUT"

echo "== compile =="
circom relation.circom --r1cs --wasm --sym --O2 -o "$OUT" -l "$ROOT" -l "$ROOT/node_modules/circomlib/circuits"
CONSTRAINTS=$(snarkjs r1cs info "$OUT/relation.r1cs" | awk '/Constraints/{print $NF}')
echo "constraints=$CONSTRAINTS"

# ptau power: next pow2 above constraints
NEED=16
C=${CONSTRAINTS:-200000}
while [ $((2 ** NEED)) -lt $((C + 1)) ]; do NEED=$((NEED + 1)); done
[ "$NEED" -lt 18 ] && NEED=18
PTAU="$OUT/ppot_0080_${NEED}.ptau"
URL="https://pse-trusted-setup-ppot.s3.eu-central-1.amazonaws.com/pot28_0080/ppot_0080_${NEED}.ptau"
if [ ! -f "$PTAU" ]; then
  echo "== download ptau $NEED =="
  curl -L --fail -o "$PTAU" "$URL"
fi

echo "== groth16 setup =="
snarkjs groth16 setup "$OUT/relation.r1cs" "$PTAU" "$OUT/relation_0000.zkey"
echo "zkctf" | snarkjs zkey contribute "$OUT/relation_0000.zkey" "$OUT/relation.zkey" --name="zkctf" -v
snarkjs zkey export verificationkey "$OUT/relation.zkey" "$OUT/verification_key.json"
node "$ROOT/scripts/export-vk.mjs"
echo "== done =="
snarkjs r1cs info "$OUT/relation.r1cs"

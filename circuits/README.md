# Circuits

`relation.circom` is ℛ from `protocol/zkctf.md`:

`h = keccak256(s ∥ δ)` and `C = keccak256(P ∥ s ∥ n)`.

Compiled with `--O2`: ~305k non-linear constraints, 6 public limbs (`hHi,hLo,cHi,cLo,pHi,pLo`).

```bash
# compile (circom 2.2)
circom relation.circom --r1cs --wasm --sym -o build -l .

# trusted setup — long (keccak). ptau 2^19 required.
bash scripts/setup.sh
# or, after pot19_final.ptau exists:
node node_modules/snarkjs/build/cli.cjs groth16 setup build/relation.r1cs build/pot19_final.ptau build/relation_0000.zkey
echo zkctf | node node_modules/snarkjs/build/cli.cjs zkey contribute build/relation_0000.zkey build/relation.zkey --name=zkctf
node node_modules/snarkjs/build/cli.cjs zkey export verificationkey build/relation.zkey build/verification_key.json
node scripts/export-vk.mjs
node scripts/verify-flags.mjs   # c=s → verify 1; c≠s → no π
```

Local setup uses one contribution. Do not reuse this zkey on mainnet without a real ceremony.

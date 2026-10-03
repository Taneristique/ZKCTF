# Circuits

`relation.circom` is ℛ from `protocol/zkctf.md`:

`h = keccak256(s ∥ δ)` and `C = keccak256(P ∥ s ∥ n)`.

Compiled with `--O2`: ~305k non-linear constraints, 6 public limbs (`hHi,hLo,cHi,cLo,pHi,pLo`).

```bash
# compile (circom 2.2)
circom relation.circom --r1cs --wasm --sym -o build -l .

# trusted setup: phase 1 = PSE perpetual powers of tau 2^19 (604 MB, prepared for phase 2)
curl -L -o build/ppot_0080_19.ptau https://pse-trusted-setup-ppot.s3.eu-central-1.amazonaws.com/pot28_0080/ppot_0080_19.ptau
node scripts/run-setup.mjs        # zkey + verification_key.json (~2 min)
node scripts/export-vk.mjs        # writes programs/zkctf/src/verifying_key.rs
node scripts/verify-flags.mjs     # c=s → verify 1; c≠s → no π
node scripts/fixture.mjs          # proof fixture for `cargo test` (verify_groth16)
cp build/relation_js/relation.wasm build/verification_key.json artifacts/
```

After a new zkey: upgrade the program, commit `artifacts/`, upload `build/relation.zkey` as a GitHub release asset and update `ZKCTF_ZKEY_URL` / `ZKCTF_ZKEY_SHA256` in the root `Dockerfile`.

Phase 2 uses one local beacon contribution. Run a multi-party phase 2 before mainnet.

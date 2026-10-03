pragma circom 2.0.0;

include "keccak256-circom/circuits/keccak.circom";
include "node_modules/circomlib/circuits/bitify.circom";
include "node_modules/circomlib/circuits/comparators.circom";

// Bytes → keccak bits (LSB-first per byte, vocdoni / Ethereum keccak256).
template BytesToBits(n) {
    signal input bytes[n];
    signal output bits[n * 8];
    component n2b[n];
    for (var i = 0; i < n; i++) {
        n2b[i] = Num2Bits(8);
        n2b[i].in <== bytes[i];
        for (var j = 0; j < 8; j++) {
            bits[i * 8 + j] <== n2b[i].out[j];
        }
    }
}

template BitsToBytes(n) {
    signal input bits[n * 8];
    signal output bytes[n];
    component b2n[n];
    for (var i = 0; i < n; i++) {
        b2n[i] = Bits2Num(8);
        for (var j = 0; j < 8; j++) {
            b2n[i].in[j] <== bits[i * 8 + j];
        }
        bytes[i] <== b2n[i].out;
    }
}

// 16-byte big-endian → field (fits BN254 scalar).
template Bytes16BE() {
    signal input bytes[16];
    signal output out;
    var acc = 0;
    for (var i = 0; i < 16; i++) {
        acc += bytes[i] * (256 ** (15 - i));
    }
    out <== acc;
}

template Eq32() {
    signal input a[32];
    signal input b[32];
    component eq[32];
    for (var i = 0; i < 32; i++) {
        eq[i] = IsEqual();
        eq[i].in[0] <== a[i];
        eq[i].in[1] <== b[i];
        eq[i].out === 1;
    }
}

// ℛ: h = keccak256(s ∥ δ) ∧ C = keccak256(P ∥ s ∥ n)
// s, δ, n, P are 32-byte values. Flag is UTF-8 zero-padded to 32.
template Relation() {
    signal input s[32];
    signal input delta[32];
    signal input nonce[32];
    signal input pBytes[32];

    signal input hHi;
    signal input hLo;
    signal input cHi;
    signal input cLo;
    signal input pHi;
    signal input pLo;

    // P limbs match pBytes
    component pPack0 = Bytes16BE();
    component pPack1 = Bytes16BE();
    for (var i = 0; i < 16; i++) {
        pPack0.bytes[i] <== pBytes[i];
        pPack1.bytes[i] <== pBytes[16 + i];
    }
    pPack0.out === pHi;
    pPack1.out === pLo;

    // St₁: h = H(s ∥ δ)   64 bytes
    signal concat64[64];
    for (var i = 0; i < 32; i++) {
        concat64[i] <== s[i];
        concat64[32 + i] <== delta[i];
    }
    component b64 = BytesToBits(64);
    for (var i = 0; i < 64; i++) {
        b64.bytes[i] <== concat64[i];
    }
    component k1 = Keccak(64 * 8, 32 * 8);
    for (var i = 0; i < 64 * 8; i++) {
        k1.in[i] <== b64.bits[i];
    }
    component hBytes = BitsToBytes(32);
    for (var i = 0; i < 256; i++) {
        hBytes.bits[i] <== k1.out[i];
    }
    component hPack0 = Bytes16BE();
    component hPack1 = Bytes16BE();
    for (var i = 0; i < 16; i++) {
        hPack0.bytes[i] <== hBytes.bytes[i];
        hPack1.bytes[i] <== hBytes.bytes[16 + i];
    }
    hPack0.out === hHi;
    hPack1.out === hLo;

    // St₂: C = H(P ∥ s ∥ n)   96 bytes
    signal concat96[96];
    for (var i = 0; i < 32; i++) {
        concat96[i] <== pBytes[i];
        concat96[32 + i] <== s[i];
        concat96[64 + i] <== nonce[i];
    }
    component b96 = BytesToBits(96);
    for (var i = 0; i < 96; i++) {
        b96.bytes[i] <== concat96[i];
    }
    component k2 = Keccak(96 * 8, 32 * 8);
    for (var i = 0; i < 96 * 8; i++) {
        k2.in[i] <== b96.bits[i];
    }
    component cBytes = BitsToBytes(32);
    for (var i = 0; i < 256; i++) {
        cBytes.bits[i] <== k2.out[i];
    }
    component cPack0 = Bytes16BE();
    component cPack1 = Bytes16BE();
    for (var i = 0; i < 16; i++) {
        cPack0.bytes[i] <== cBytes.bytes[i];
        cPack1.bytes[i] <== cBytes.bytes[16 + i];
    }
    cPack0.out === cHi;
    cPack1.out === cLo;
}

component main {public [hHi, hLo, cHi, cLo, pHi, pLo]} = Relation();

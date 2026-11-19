// PROTOTYPE (not part of the production build). See protocol/dynamic.md.
// Measured with circom 2.2.2 --O2, circomlib 2.0.5: D=14 -> 4351 non-linear constraints.
// Domain tags: DOM_H=1, DOM_C=2, DOM_LEAF=3 (Merkle nodes are untagged Poseidon(2)).
pragma circom 2.0.0;
include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/switcher.circom";

template MerklePath(D) {
    signal input leaf;
    signal input idxBits[D];
    signal input sib[D];
    signal output root;
    component sw[D];
    component h[D];
    signal cur[D + 1];
    cur[0] <== leaf;
    for (var i = 0; i < D; i++) {
        idxBits[i] * (idxBits[i] - 1) === 0;
        sw[i] = Switcher();
        sw[i].sel <== idxBits[i];
        sw[i].L <== cur[i];
        sw[i].R <== sib[i];
        h[i] = Poseidon(2);
        h[i].inputs[0] <== sw[i].outL;
        h[i].inputs[1] <== sw[i].outR;
        cur[i + 1] <== h[i].out;
    }
    root <== cur[D];
}

// DOM_H=1 DOM_C=2 DOM_LEAF=3
template DynRelation(D) {
    signal input root;
    signal input C;
    signal input pHi;
    signal input pLo;
    signal input level;
    signal input sHi;
    signal input sLo;
    signal input delta;
    signal input nonce;
    signal input idxBits[D];
    signal input sib[D];

    component hh = Poseidon(4);
    hh.inputs[0] <== 1;
    hh.inputs[1] <== sHi;
    hh.inputs[2] <== sLo;
    hh.inputs[3] <== delta;

    component lf = Poseidon(5);
    lf.inputs[0] <== 3;
    lf.inputs[1] <== pHi;
    lf.inputs[2] <== pLo;
    lf.inputs[3] <== level;
    lf.inputs[4] <== hh.out;

    component mp = MerklePath(D);
    mp.leaf <== lf.out;
    for (var i = 0; i < D; i++) {
        mp.idxBits[i] <== idxBits[i];
        mp.sib[i] <== sib[i];
    }
    root === mp.root;

    component cc = Poseidon(6);
    cc.inputs[0] <== 2;
    cc.inputs[1] <== pHi;
    cc.inputs[2] <== pLo;
    cc.inputs[3] <== sHi;
    cc.inputs[4] <== sLo;
    cc.inputs[5] <== nonce;
    cc.out === C;
}

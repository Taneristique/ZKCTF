/** Mirrors programs/zkctf/src/payout.rs */
export const ENTRY_ATOMS = 5_000_000;
export const N_WINNERS = 10;
export const TREASURY_BPS = 2_000;
export const WEIGHTS = [2500, 1800, 1300, 1000, 800, 700, 600, 500, 400, 400];

export function splitPot(potAtoms, k) {
  const n = Math.min(Math.max(0, Number(k) || 0), N_WINNERS);
  if (!potAtoms) return { treasury: 0, pays: Array(10).fill(0) };
  if (n === 0) return { treasury: potAtoms, pays: Array(10).fill(0) };
  const treasury0 = Math.floor((potAtoms * TREASURY_BPS) / 10_000);
  const prize = potAtoms - treasury0;
  const denom = WEIGHTS.slice(0, n).reduce((a, b) => a + b, 0);
  const pays = Array(10).fill(0);
  let paid = 0;
  for (let i = 0; i < n; i++) {
    pays[i] = Math.floor((prize * WEIGHTS[i]) / denom);
    paid += pays[i];
  }
  return { treasury: treasury0 + (prize - paid), pays };
}

export function example(entries, solvers) {
  const pot = entries * ENTRY_ATOMS;
  const { treasury, pays } = splitPot(pot, Math.min(solvers, N_WINNERS));
  const usdc = (n) => n / 1e6;
  return {
    entries,
    solvers,
    potUsdc: usdc(pot),
    treasuryUsdc: usdc(treasury),
    prizeUsdc: usdc(pot - treasury),
    paysUsdc: pays.filter((p) => p > 0).map(usdc),
  };
}

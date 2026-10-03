/// Official pot. Amounts in USDC atoms (6 decimals). 5 USDC = 5_000_000.
pub const ENTRY_ATOMS: u64 = 5_000_000;
pub const N_WINNERS: u8 = 10;
/// 20% of the pot goes to treasury. The rest is the prize pool.
pub const TREASURY_BPS: u16 = 2_000;
/// Share of the prize pool for ranks 1..10, in basis points. Sum = 10_000.
/// Same table for 1 player or 100: only the first k ranks are used, then renormalized.
pub const WEIGHTS: [u16; 10] = [2_500, 1_800, 1_300, 1_000, 800, 700, 600, 500, 400, 400];

/// Returns (treasury_atoms, pay[10]). Dust from integer division is added to treasury.
/// k = how many ranked solvers this week (0..=10). k=0 → whole pot to treasury.
pub fn split_pot(pot: u64, k: u8) -> (u64, [u64; 10]) {
    let k = core::cmp::min(k, N_WINNERS) as usize;
    if pot == 0 {
        return (0, [0; 10]);
    }
    if k == 0 {
        return (pot, [0; 10]);
    }
    let treasury = pot.saturating_mul(u64::from(TREASURY_BPS)) / 10_000;
    let prize = pot.saturating_sub(treasury);
    let denom: u64 = WEIGHTS[..k].iter().map(|w| u64::from(*w)).sum();
    let mut pays = [0u64; 10];
    let mut paid = 0u64;
    if denom > 0 {
        for i in 0..k {
            pays[i] = prize.saturating_mul(u64::from(WEIGHTS[i])) / denom;
            paid = paid.saturating_add(pays[i]);
        }
    }
    (treasury.saturating_add(prize.saturating_sub(paid)), pays)
}

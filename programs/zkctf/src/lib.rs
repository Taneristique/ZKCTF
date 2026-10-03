use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    alt_bn128::prelude::{
        alt_bn128_addition, alt_bn128_multiplication, alt_bn128_pairing, ALT_BN128_PAIRING_ELEMENT_LEN,
    },
    entrypoint,
    entrypoint::ProgramResult,
    instruction::{AccountMeta, Instruction},
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};

pub mod payout;
pub mod verifying_key;
use payout::*;
use verifying_key::*;

const TOKEN_PROGRAM: Pubkey = solana_program::pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
/// Devnet USDC (Circle). Mainnet mint is EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v — rebuild for mainnet.
pub const USDC_MINT: Pubkey = solana_program::pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

pub const ID: Pubkey = solana_program::pubkey!("34Kut3tQ4HTJMF2gVvnT6shhmenPE6463xnGk5sxDtz7");

#[cfg(not(feature = "no-entrypoint"))]
entrypoint!(process_instruction);

const D_INIT: [u8; 8] = [175, 175, 109, 31, 13, 152, 155, 237];
const D_MINT: [u8; 8] = [174, 36, 106, 250, 202, 238, 71, 231];
const D_ROUND: [u8; 8] = [229, 218, 236, 169, 231, 80, 134, 112];
const D_SUBMIT: [u8; 8] = [88, 166, 102, 181, 162, 127, 170, 48];
const D_ENTER: [u8; 8] = [166, 162, 71, 230, 92, 51, 37, 43];
const D_SETTLE: [u8; 8] = [175, 42, 185, 87, 144, 131, 102, 212];

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Config {
    pub discriminator: [u8; 8],
    pub authority: Pubkey,
    pub bump: u8,
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Seat {
    pub discriminator: [u8; 8],
    pub wallet: Pubkey,
    pub tier: u8,
    pub expiry_unix: i64,
    pub slots: u8,
    pub prompts_used: u8,
    pub sku_months: u8,
    pub bump: u8,
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Round {
    pub discriminator: [u8; 8],
    pub start: i64,
    pub end: i64,
    pub level_count: u8,
    pub n_winners: u8,
    pub entries: u32,
    pub pot_atoms: u64,
    pub settled: u8,
    pub commitments: [[u8; 32]; 8],
    pub bump: u8,
}

/// One PDA per player: entry + linear solve progress for the current round.
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Entry {
    pub discriminator: [u8; 8],
    pub wallet: Pubkey,
    pub round_start: i64,
    /// Bit i set ⇔ level i verified on-chain. Always contiguous from bit 0 (linear CTF).
    pub solved_mask: u8,
    /// Unix time of the most recent verified submit; finish time once every level is set.
    pub last_ts: i64,
    pub bump: u8,
}

pub const ENTRY_SPACE: usize = 8 + 32 + 8 + 1 + 8 + 1;

/// Next mask after verifying `level`, enforcing in-order solving.
pub fn mark_solved(mask: u8, level: u8) -> Result<u8, ProgramError> {
    if level >= 8 {
        return Err(ProgramError::Custom(2));
    }
    let bit = 1u8 << level;
    if mask & bit != 0 {
        return Err(ProgramError::Custom(6));
    }
    if mask != bit - 1 {
        return Err(ProgramError::Custom(7));
    }
    Ok(mask | bit)
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    if data.len() < 8 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let tag: [u8; 8] = data[..8].try_into().unwrap();
    let rest = &data[8..];
    if tag == D_INIT {
        initialize(program_id, accounts)
    } else if tag == D_MINT {
        if rest.len() < 4 {
            return Err(ProgramError::InvalidInstructionData);
        }
        mint_seat(program_id, accounts, rest[0], rest[1], rest[2], rest[3])
    } else if tag == D_ROUND {
        create_round(program_id, accounts, rest)
    } else if tag == D_ENTER {
        enter_round(program_id, accounts)
    } else if tag == D_SETTLE {
        if rest.is_empty() {
            return Err(ProgramError::InvalidInstructionData);
        }
        settle(program_id, accounts, rest[0])
    } else if tag == D_SUBMIT {
        submit(program_id, accounts, rest)
    } else {
        Err(ProgramError::InvalidInstructionData)
    }
}

fn initialize(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let acc = &mut accounts.iter();
    let payer = next_account_info(acc)?;
    let authority = next_account_info(acc)?;
    let config = next_account_info(acc)?;
    let _sys = next_account_info(acc)?;
    if !payer.is_signer || !authority.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    let (pda, bump) = Pubkey::find_program_address(&[b"config"], program_id);
    if pda != *config.key {
        return Err(ProgramError::InvalidSeeds);
    }
    if !config.data_is_empty() {
        return Err(ProgramError::AccountAlreadyInitialized);
    }
    create_pda(program_id, payer, config, 8 + 32 + 1, &[b"config"], bump)?;
    let row = Config {
        discriminator: D_INIT,
        authority: *authority.key,
        bump,
    };
    row.serialize(&mut &mut config.data.borrow_mut()[..])?;
    Ok(())
}

fn mint_seat(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    tier: u8,
    months: u8,
    slots: u8,
    prompts_used: u8,
) -> ProgramResult {
    if (tier != 0 && tier != 1) || (months != 1 && months != 3 && months != 12) {
        return Err(ProgramError::InvalidArgument);
    }
    let acc = &mut accounts.iter();
    let payer = next_account_info(acc)?;
    let wallet = next_account_info(acc)?;
    let authority = next_account_info(acc)?;
    let config = next_account_info(acc)?;
    let seat = next_account_info(acc)?;
    let _sys = next_account_info(acc)?;
    if !payer.is_signer || !wallet.is_signer || !authority.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    let cfg = load_config(program_id, config)?;
    if cfg.authority != *authority.key {
        return Err(ProgramError::Custom(3));
    }
    let (pda, bump) = Pubkey::find_program_address(&[b"seat", wallet.key.as_ref()], program_id);
    if pda != *seat.key {
        return Err(ProgramError::InvalidSeeds);
    }
    let now = solana_program::clock::Clock::get()?.unix_timestamp;
    let add = i64::from(months) * 30 * 24 * 60 * 60;
    if seat.data_is_empty() {
        create_pda(
            program_id,
            payer,
            seat,
            8 + 32 + 1 + 8 + 1 + 1 + 1 + 1,
            &[b"seat", wallet.key.as_ref()],
            bump,
        )?;
        let row = Seat {
            discriminator: D_MINT,
            wallet: *wallet.key,
            tier,
            expiry_unix: now.saturating_add(add),
            slots,
            prompts_used,
            sku_months: months,
            bump,
        };
        row.serialize(&mut &mut seat.data.borrow_mut()[..])?;
    } else {
        let mut row = Seat::try_from_slice(&seat.data.borrow())?;
        if row.wallet != *wallet.key {
            return Err(ProgramError::InvalidAccountData);
        }
        let base = row.expiry_unix.max(now);
        row.expiry_unix = base.saturating_add(add);
        row.tier = tier;
        row.slots = slots;
        row.sku_months = months;
        row.serialize(&mut &mut seat.data.borrow_mut()[..])?;
    }
    Ok(())
}

fn create_round(program_id: &Pubkey, accounts: &[AccountInfo], rest: &[u8]) -> ProgramResult {
    // start:i64 end:i64 level_count:u8 commitments:[[u8;32];8]
    if rest.len() < 8 + 8 + 1 + 32 * 8 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let start = i64::from_le_bytes(rest[0..8].try_into().unwrap());
    let end = i64::from_le_bytes(rest[8..16].try_into().unwrap());
    let level_count = rest[16];
    if level_count == 0 || level_count > 8 || end <= start {
        return Err(ProgramError::InvalidArgument);
    }
    let mut commitments = [[0u8; 32]; 8];
    for i in 0..8 {
        commitments[i].copy_from_slice(&rest[17 + i * 32..17 + (i + 1) * 32]);
    }
    let acc = &mut accounts.iter();
    let payer = next_account_info(acc)?;
    let authority = next_account_info(acc)?;
    let config = next_account_info(acc)?;
    let round = next_account_info(acc)?;
    let _sys = next_account_info(acc)?;
    let cfg = load_config(program_id, config)?;
    if !authority.is_signer || cfg.authority != *authority.key {
        return Err(ProgramError::Custom(3));
    }
    let (pda, bump) = Pubkey::find_program_address(&[b"round"], program_id);
    if pda != *round.key {
        return Err(ProgramError::InvalidSeeds);
    }
    // Allow a new week only after the previous window ended or settled.
    if !round.data_is_empty() {
        if let Ok(prev) = Round::try_from_slice(&round.data.borrow()) {
            let now = solana_program::clock::Clock::get()?.unix_timestamp;
            if prev.settled == 0 && now <= prev.end {
                return Err(ProgramError::Custom(4));
            }
        }
    }
    create_pda(
        program_id,
        payer,
        round,
        8 + 8 + 8 + 1 + 1 + 4 + 8 + 1 + 32 * 8 + 1,
        &[b"round"],
        bump,
    )?;
    let row = Round {
        discriminator: D_ROUND,
        start,
        end,
        level_count,
        n_winners: N_WINNERS,
        entries: 0,
        pot_atoms: 0,
        settled: 0,
        commitments,
        bump,
    };
    row.serialize(&mut &mut round.data.borrow_mut()[..])?;
    Ok(())
}

fn enter_round(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let acc = &mut accounts.iter();
    let player = next_account_info(acc)?;
    let round = next_account_info(acc)?;
    let entry = next_account_info(acc)?;
    let _sys = next_account_info(acc)?;
    if !player.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    assert_round(program_id, round)?;
    let mut round_row = Round::try_from_slice(&round.data.borrow())?;
    let now = solana_program::clock::Clock::get()?.unix_timestamp;
    if now < round_row.start || now > round_row.end || round_row.settled != 0 {
        return Err(ProgramError::Custom(2));
    }
    if round_row.n_winners != N_WINNERS {
        return Err(ProgramError::InvalidAccountData);
    }
    let (pda, bump) = Pubkey::find_program_address(&[b"entry", player.key.as_ref()], program_id);
    if pda != *entry.key {
        return Err(ProgramError::InvalidSeeds);
    }
    let prev = if entry.data_is_empty() {
        None
    } else {
        Entry::try_from_slice(&entry.data.borrow()).ok()
    };
    let fresh = prev.as_ref().map(|e| e.round_start != round_row.start).unwrap_or(true);
    if entry.data_is_empty() {
        create_pda(
            program_id,
            player,
            entry,
            ENTRY_SPACE,
            &[b"entry", player.key.as_ref()],
            bump,
        )?;
    }
    if fresh {
        let player_ata = next_account_info(acc)?;
        let pot_ata = next_account_info(acc)?;
        let token_prog = next_account_info(acc)?;
        if *token_prog.key != TOKEN_PROGRAM {
            return Err(ProgramError::IncorrectProgramId);
        }
        assert_usdc_ata(player_ata)?;
        assert_pot_ata(program_id, pot_ata)?;
        transfer_usdc(player_ata, pot_ata, player, ENTRY_ATOMS, token_prog, &[])?;
        round_row.entries = round_row.entries.saturating_add(1);
        round_row.pot_atoms = round_row.pot_atoms.saturating_add(ENTRY_ATOMS);
        round_row.serialize(&mut &mut round.data.borrow_mut()[..])?;
    }
    let (solved_mask, last_ts) = match (&prev, fresh) {
        (Some(e), false) => (e.solved_mask, e.last_ts),
        _ => (0, 0),
    };
    let row = Entry {
        discriminator: D_ENTER,
        wallet: *player.key,
        round_start: round_row.start,
        solved_mask,
        last_ts,
        bump,
    };
    row.serialize(&mut &mut entry.data.borrow_mut()[..])?;
    Ok(())
}

fn settle(program_id: &Pubkey, accounts: &[AccountInfo], k: u8) -> ProgramResult {
    if k > N_WINNERS {
        return Err(ProgramError::InvalidArgument);
    }
    let acc = &mut accounts.iter();
    let authority = next_account_info(acc)?;
    let config = next_account_info(acc)?;
    let round = next_account_info(acc)?;
    let pot_ata = next_account_info(acc)?;
    let vault = next_account_info(acc)?;
    let treasury_ata = next_account_info(acc)?;
    let token_prog = next_account_info(acc)?;
    let cfg = load_config(program_id, config)?;
    if !authority.is_signer || cfg.authority != *authority.key {
        return Err(ProgramError::Custom(3));
    }
    let (vault_pda, vault_bump) = Pubkey::find_program_address(&[b"pot"], program_id);
    if vault_pda != *vault.key || *token_prog.key != TOKEN_PROGRAM {
        return Err(ProgramError::InvalidSeeds);
    }
    assert_round(program_id, round)?;
    assert_pot_ata(program_id, pot_ata)?;
    let mut row = Round::try_from_slice(&round.data.borrow())?;
    let now = solana_program::clock::Clock::get()?.unix_timestamp;
    if now <= row.end || row.settled != 0 {
        return Err(ProgramError::Custom(2));
    }
    let (treasury, pays) = split_pot(row.pot_atoms, k);
    let seeds: &[&[u8]] = &[b"pot", &[vault_bump]];
    if treasury > 0 {
        transfer_usdc(pot_ata, treasury_ata, vault, treasury, token_prog, &[seeds])?;
    }
    for pay in pays.iter().take(k as usize) {
        let dest = next_account_info(acc)?;
        if *pay > 0 {
            transfer_usdc(pot_ata, dest, vault, *pay, token_prog, &[seeds])?;
        }
    }
    row.settled = 1;
    row.serialize(&mut &mut round.data.borrow_mut()[..])?;
    Ok(())
}

fn transfer_usdc<'a>(
    from: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    authority: &AccountInfo<'a>,
    amount: u64,
    token_prog: &AccountInfo<'a>,
    signer: &[&[&[u8]]],
) -> ProgramResult {
    let mut data = Vec::with_capacity(9);
    data.push(3);
    data.extend_from_slice(&amount.to_le_bytes());
    let ix = Instruction {
        program_id: TOKEN_PROGRAM,
        accounts: vec![
            AccountMeta::new(*from.key, false),
            AccountMeta::new(*to.key, false),
            AccountMeta::new_readonly(*authority.key, true),
        ],
        data,
    };
    if signer.is_empty() {
        invoke(&ix, &[from.clone(), to.clone(), authority.clone(), token_prog.clone()])
    } else {
        invoke_signed(
            &ix,
            &[from.clone(), to.clone(), authority.clone(), token_prog.clone()],
            signer,
        )
    }
}

fn load_config(program_id: &Pubkey, config: &AccountInfo) -> Result<Config, ProgramError> {
    let (pda, _) = Pubkey::find_program_address(&[b"config"], program_id);
    if pda != *config.key {
        return Err(ProgramError::InvalidSeeds);
    }
    if config.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    let cfg = Config::try_from_slice(&config.data.borrow())?;
    if cfg.discriminator != D_INIT {
        return Err(ProgramError::InvalidAccountData);
    }
    Ok(cfg)
}

fn assert_round(program_id: &Pubkey, round: &AccountInfo) -> ProgramResult {
    let (pda, _) = Pubkey::find_program_address(&[b"round"], program_id);
    if pda != *round.key {
        return Err(ProgramError::InvalidSeeds);
    }
    if round.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    Ok(())
}

/// SPL token account layout: mint [0..32], owner [32..64].
fn assert_usdc_ata(ata: &AccountInfo) -> ProgramResult {
    if *ata.owner != TOKEN_PROGRAM {
        return Err(ProgramError::IncorrectProgramId);
    }
    let data = ata.try_borrow_data()?;
    if data.len() < 64 {
        return Err(ProgramError::InvalidAccountData);
    }
    let mint = Pubkey::new_from_array(data[0..32].try_into().unwrap());
    if mint != USDC_MINT {
        return Err(ProgramError::Custom(5));
    }
    Ok(())
}

/// USDC token account whose token-owner is the `["pot"]` vault PDA.
fn assert_pot_ata(program_id: &Pubkey, pot_ata: &AccountInfo) -> ProgramResult {
    assert_usdc_ata(pot_ata)?;
    let (vault, _) = Pubkey::find_program_address(&[b"pot"], program_id);
    let data = pot_ata.try_borrow_data()?;
    let owner = Pubkey::new_from_array(data[32..64].try_into().unwrap());
    if owner != vault {
        return Err(ProgramError::Custom(8));
    }
    Ok(())
}

fn submit(program_id: &Pubkey, accounts: &[AccountInfo], rest: &[u8]) -> ProgramResult {
    // level:u8 commit:[32] proof_a:[64] proof_b:[128] proof_c:[64]
    let need = 1 + 32 + 64 + 128 + 64;
    if rest.len() < need {
        return Err(ProgramError::InvalidInstructionData);
    }
    let level = rest[0];
    let mut commit = [0u8; 32];
    commit.copy_from_slice(&rest[1..33]);
    let proof_a: [u8; 64] = rest[33..97].try_into().unwrap();
    let proof_b: [u8; 128] = rest[97..225].try_into().unwrap();
    let proof_c: [u8; 64] = rest[225..289].try_into().unwrap();

    let acc = &mut accounts.iter();
    let player = next_account_info(acc)?;
    let entry = next_account_info(acc)?;
    let round = next_account_info(acc)?;
    if !player.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if entry.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    assert_round(program_id, round)?;
    let (entry_pda, _) = Pubkey::find_program_address(&[b"entry", player.key.as_ref()], program_id);
    if entry_pda != *entry.key {
        return Err(ProgramError::InvalidSeeds);
    }
    let mut entry_row = Entry::try_from_slice(&entry.data.borrow())?;
    if entry_row.wallet != *player.key {
        return Err(ProgramError::InvalidAccountData);
    }
    let now = solana_program::clock::Clock::get()?.unix_timestamp;
    let round_row = Round::try_from_slice(&round.data.borrow())?;
    if entry_row.round_start != round_row.start {
        return Err(ProgramError::Custom(1));
    }
    if now < round_row.start || now > round_row.end || level >= round_row.level_count {
        return Err(ProgramError::Custom(2));
    }
    let next_mask = mark_solved(entry_row.solved_mask, level)?;
    let h = round_row.commitments[level as usize];
    let p = player.key.to_bytes();
    let publics = pack_publics(&h, &commit, &p);
    verify_groth16(&proof_a, &proof_b, &proof_c, &publics)?;

    entry_row.solved_mask = next_mask;
    entry_row.last_ts = now;
    entry_row.serialize(&mut &mut entry.data.borrow_mut()[..])?;
    Ok(())
}

fn pack_publics(h: &[u8; 32], c: &[u8; 32], p: &[u8; 32]) -> [[u8; 32]; 6] {
    fn limb(bytes16: &[u8]) -> [u8; 32] {
        let mut out = [0u8; 32];
        out[16..32].copy_from_slice(bytes16);
        out
    }
    [
        limb(&h[0..16]),
        limb(&h[16..32]),
        limb(&c[0..16]),
        limb(&c[16..32]),
        limb(&p[0..16]),
        limb(&p[16..32]),
    ]
}

/// Groth16 pairing check (BN254 / alt_bn128), vk from verifying_key.rs.
fn verify_groth16(
    proof_a: &[u8; 64],
    proof_b: &[u8; 128],
    proof_c: &[u8; 64],
    publics: &[[u8; 32]; 6],
) -> ProgramResult {
    if VK_ALPHA_G1.iter().all(|b| *b == 0) {
        return Err(ProgramError::Custom(10));
    }
    // L = IC[0] + Σ pub_i * IC[i+1]
    let mut acc = VK_IC[0];
    for (i, pub_i) in publics.iter().enumerate() {
        let mut mul_in = [0u8; 96];
        mul_in[..64].copy_from_slice(&VK_IC[i + 1]);
        mul_in[64..].copy_from_slice(pub_i);
        let prod = alt_bn128_multiplication(&mul_in).map_err(|_| ProgramError::Custom(11))?;
        let mut add_in = [0u8; 128];
        add_in[..64].copy_from_slice(&acc);
        add_in[64..].copy_from_slice(&prod);
        let sum = alt_bn128_addition(&add_in).map_err(|_| ProgramError::Custom(12))?;
        acc.copy_from_slice(&sum);
    }
    // pairing: e(-A,B) * e(alpha,beta) * e(L,gamma) * e(C,delta) == 1
    // proof_a arrives already negated (circuits/scripts/prove.mjs).
    let mut pairing = Vec::with_capacity(ALT_BN128_PAIRING_ELEMENT_LEN * 4);
    pairing.extend_from_slice(proof_a);
    pairing.extend_from_slice(proof_b);
    pairing.extend_from_slice(&VK_ALPHA_G1);
    pairing.extend_from_slice(&VK_BETA_G2);
    pairing.extend_from_slice(&acc);
    pairing.extend_from_slice(&VK_GAMMA_G2);
    pairing.extend_from_slice(proof_c);
    pairing.extend_from_slice(&VK_DELTA_G2);
    let out = alt_bn128_pairing(&pairing).map_err(|_| ProgramError::Custom(13))?;
    if out.len() != 32 || out[31] != 1 {
        return Err(ProgramError::Custom(14));
    }
    Ok(())
}

fn create_pda<'a>(
    program_id: &Pubkey,
    payer: &AccountInfo<'a>,
    pda: &AccountInfo<'a>,
    space: usize,
    seeds: &[&[u8]],
    bump: u8,
) -> ProgramResult {
    if !pda.data_is_empty() {
        return Ok(());
    }
    let rent = Rent::get()?.minimum_balance(space);
    let mut bump_seeds: Vec<&[u8]> = seeds.to_vec();
    let bump_sl = [bump];
    bump_seeds.push(&bump_sl);
    invoke_signed(
        &system_instruction::create_account(payer.key, pda.key, rent, space as u64, program_id),
        &[payer.clone(), pda.clone()],
        &[bump_seeds.as_slice()],
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn entry_space_matches_borsh() {
        let e = Entry {
            discriminator: D_ENTER,
            wallet: Pubkey::new_unique(),
            round_start: 1,
            solved_mask: 0b111,
            last_ts: 2,
            bump: 255,
        };
        assert_eq!(e.try_to_vec().unwrap().len(), ENTRY_SPACE);
    }

    #[test]
    fn mark_solved_is_linear() {
        let mut m = 0u8;
        for level in 0..8 {
            m = mark_solved(m, level).unwrap();
        }
        assert_eq!(m, 0xFF);
        assert_eq!(mark_solved(0, 1), Err(ProgramError::Custom(7)));
        assert_eq!(mark_solved(0b1, 0), Err(ProgramError::Custom(6)));
        assert_eq!(mark_solved(0b11, 3), Err(ProgramError::Custom(7)));
        assert_eq!(mark_solved(0xFF, 8), Err(ProgramError::Custom(2)));
    }
}

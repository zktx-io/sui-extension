import { FileMap, MoveTemplate, withCommon } from './types';

const README = withCommon(`
# Locked Stake (Mysten Labs)

Lock SUI and staked SUI until a specific epoch, and perform stake/unstake operations while locked.
Includes:
- \`epoch_time_lock.move\`: simple epoch-based lock type
- \`locked_stake.move\`: lock container supporting deposit, stake, unstake, and unlock
- \`locked_stake_tests.move\`: scenario-based tests (advance epoch, stake/unstake, unlock)

Source: https://github.com/MystenLabs/sui/tree/main/examples/move/locked_stake
`);

const moveToml = (pkg: string) =>
  `
[package]
name = "${pkg}"
version = "0.0.1"
edition = "2024.beta"

[dependencies]

# For remote import, use the \`{ git = "...", subdir = "...", rev = "..." }\`.
# Revision can be a branch, a tag, and a commit hash.
# MyRemotePackage = { git = "https://some.remote/host.git", subdir = "remote/path", rev = "main" }

# For local dependencies use \`local = path\`. Path is relative to the package root
# Local = { local = "../path/to" }

# To resolve a version conflict and force a specific version for dependency
# override use \`override = true\`
# Override = { local = "../conflicting/version", override = true }

[addresses]
${pkg} = "0x0"
`.trim();

function files(pkg: string): FileMap {
  return {
    'Move.toml': moveToml(pkg),
    'README.md': README,

    'sources/epoch_time_lock.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::epoch_time_lock;

/// The epoch passed into the creation of a lock has already passed.
const EEpochAlreadyPassed: u64 = 0;

/// Attempt is made to unlock a lock that cannot be unlocked yet.
const EEpochNotYetEnded: u64 = 1;

/// Holder of an epoch number that can only be discarded in the epoch or
/// after the epoch has passed.
public struct EpochTimeLock has copy, store {
    epoch: u64,
}

/// Create a new epoch time lock with \`epoch\`. Aborts if the current epoch is less than the input epoch.
public fun new(epoch: u64, ctx: &TxContext): EpochTimeLock {
    assert!(tx_context::epoch(ctx) < epoch, EEpochAlreadyPassed);
    EpochTimeLock { epoch }
}

/// Destroys an epoch time lock. Aborts if the current epoch is less than the locked epoch.
public fun destroy(lock: EpochTimeLock, ctx: &TxContext) {
    let EpochTimeLock { epoch } = lock;
    assert!(tx_context::epoch(ctx) >= epoch, EEpochNotYetEnded);
}

/// Getter for the epoch number.
public fun epoch(lock: &EpochTimeLock): u64 {
    lock.epoch
}
`.trim(),

    'sources/locked_stake.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::locked_stake;

use ${pkg}::epoch_time_lock::{Self, EpochTimeLock};
use sui::balance::{Self, Balance};
use sui::coin;
use sui::sui::SUI;
use sui::vec_map::{Self, VecMap};
use sui_system::staking_pool::StakedSui;
use sui_system::sui_system::{Self, SuiSystemState};

const EInsufficientBalance: u64 = 0;
const EStakeObjectNonExistent: u64 = 1;

/// An object that locks SUI tokens and stake objects until a given epoch, and allows
/// staking and unstaking operations when locked.
public struct LockedStake has key {
    id: UID,
    staked_sui: VecMap<ID, StakedSui>,
    sui: Balance<SUI>,
    locked_until_epoch: EpochTimeLock,
}

// ============================= basic operations =============================

/// Create a new LockedStake object with empty staked_sui and sui balance given a lock time.
/// Aborts if the given epoch has already passed.
public fun new(locked_until_epoch: u64, ctx: &mut TxContext): LockedStake {
    LockedStake {
        id: object::new(ctx),
        staked_sui: vec_map::empty(),
        sui: balance::zero(),
        locked_until_epoch: epoch_time_lock::new(locked_until_epoch, ctx),
    }
}

/// Unlocks and returns all the assets stored inside this LockedStake object.
/// Aborts if the unlock epoch is in the future.
public fun unlock(ls: LockedStake, ctx: &TxContext): (VecMap<ID, StakedSui>, Balance<SUI>) {
    let LockedStake { id, staked_sui, sui, locked_until_epoch } = ls;
    epoch_time_lock::destroy(locked_until_epoch, ctx);
    object::delete(id);
    (staked_sui, sui)
}

/// Deposit a new stake object to the LockedStake object.
public fun deposit_staked_sui(ls: &mut LockedStake, staked_sui: StakedSui) {
    let id = object::id(&staked_sui);
    // This insertion can't abort since each object has a unique id.
    vec_map::insert(&mut ls.staked_sui, id, staked_sui);
}

/// Deposit sui balance to the LockedStake object.
public fun deposit_sui(ls: &mut LockedStake, sui: Balance<SUI>) {
    balance::join(&mut ls.sui, sui);
}

/// Take \`amount\` of SUI from the sui balance, stakes it, and puts the stake object
/// back into the staked sui vec map.
public fun stake(
    ls: &mut LockedStake,
    sui_system: &mut SuiSystemState,
    amount: u64,
    validator_address: address,
    ctx: &mut TxContext,
) {
    assert!(balance::value(&ls.sui) >= amount, EInsufficientBalance);
    let stake = sui_system::request_add_stake_non_entry(
        sui_system,
        coin::from_balance(balance::split(&mut ls.sui, amount), ctx),
        validator_address,
        ctx,
    );
    deposit_staked_sui(ls, stake);
}

/// Unstake the stake object with \`staked_sui_id\` and puts the resulting principal
/// and rewards back into the locked sui balance.
/// Returns the amount of SUI unstaked, including both principal and rewards.
/// Aborts if no stake exists with the given id.
public fun unstake(
    ls: &mut LockedStake,
    sui_system: &mut SuiSystemState,
    staked_sui_id: ID,
    ctx: &mut TxContext,
): u64 {
    assert!(vec_map::contains(&ls.staked_sui, &staked_sui_id), EStakeObjectNonExistent);
    let (_, stake) = vec_map::remove(&mut ls.staked_sui, &staked_sui_id);
    let sui_balance = sui_system::request_withdraw_stake_non_entry(sui_system, stake, ctx);
    let amount = balance::value(&sui_balance);
    deposit_sui(ls, sui_balance);
    amount
}

// ============================= getters =============================

public fun staked_sui(ls: &LockedStake): &VecMap<ID, StakedSui> {
    &ls.staked_sui
}

public fun sui_balance(ls: &LockedStake): u64 {
    balance::value(&ls.sui)
}

public fun locked_until_epoch(ls: &LockedStake): u64 {
    epoch_time_lock::epoch(&ls.locked_until_epoch)
}

// TODO: possibly add some scenarios like switching stake, creating a new LockedStake and transferring
// it to the sender, etc. But these can also be done as PTBs.
`.trim(),

    'tests/locked_stake_tests.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

#[test_only]
#[allow(deprecated_usage)] // TODO: update tests to not use deprecated governance
module ${pkg}::locked_stake_tests;

use ${pkg}::epoch_time_lock;
use ${pkg}::locked_stake as ls;
use std::unit_test::assert_eq;
use sui::balance;
use sui::coin;
use sui::test_scenario;
use sui::test_utils::destroy;
use sui::vec_map;
use sui_system::governance_test_utils::{advance_epoch, set_up_sui_system_state};
use sui_system::sui_system::{Self, SuiSystemState};

const MIST_PER_SUI: u64 = 1_000_000_000;

#[test]
#[expected_failure(abort_code = epoch_time_lock::EEpochAlreadyPassed)]
fun test_incorrect_creation() {
    let mut scenario_val = test_scenario::begin(@0x0);
    let scenario = &mut scenario_val;

    set_up_sui_system_state(vector[@0x1, @0x2, @0x3]);

    // Advance epoch twice so we are now at epoch 2.
    advance_epoch(scenario);
    advance_epoch(scenario);
    let ctx = test_scenario::ctx(scenario);
    assert_eq!(tx_context::epoch(ctx), 2);

    // Create a locked stake with epoch 1. Should fail here.
    let ls = ls::new(1, ctx);

    destroy(ls);
    test_scenario::end(scenario_val);
}

#[test]
fun test_deposit_stake_unstake() {
    let mut scenario_val = test_scenario::begin(@0x0);
    let scenario = &mut scenario_val;

    set_up_sui_system_state(vector[@0x1, @0x2, @0x3]);

    let mut ls = ls::new(10, test_scenario::ctx(scenario));

    // Deposit 100 SUI.
    ls::deposit_sui(&mut ls, balance::create_for_testing(100 * MIST_PER_SUI));

    assert_eq!(ls::sui_balance(&ls), 100 * MIST_PER_SUI);

    test_scenario::next_tx(scenario, @0x1);
    let mut system_state = test_scenario::take_shared<SuiSystemState>(scenario);

    // Stake 10 of the 100 SUI.
    ls::stake(&mut ls, &mut system_state, 10 * MIST_PER_SUI, @0x1, test_scenario::ctx(scenario));
    test_scenario::return_shared(system_state);

    assert_eq!(ls::sui_balance(&ls), 90 * MIST_PER_SUI);
    assert_eq!(vec_map::length(ls::staked_sui(&ls)), 1);

    test_scenario::next_tx(scenario, @0x1);
    let mut system_state = test_scenario::take_shared<SuiSystemState>(scenario);
    let ctx = test_scenario::ctx(scenario);

    // Create a StakedSui object and add it to the LockedStake object.
    let staked_sui = sui_system::request_add_stake_non_entry(
        &mut system_state,
        coin::mint_for_testing(20 * MIST_PER_SUI, ctx),
        @0x2,
        ctx,
    );
    test_scenario::return_shared(system_state);

    ls::deposit_staked_sui(&mut ls, staked_sui);
    assert_eq!(ls::sui_balance(&ls), 90 * MIST_PER_SUI);
    assert_eq!(vec_map::length(ls::staked_sui(&ls)), 2);
    advance_epoch(scenario);

    test_scenario::next_tx(scenario, @0x1);
    let (staked_sui_id, _) = vec_map::get_entry_by_idx(ls::staked_sui(&ls), 0);
    let mut system_state = test_scenario::take_shared<SuiSystemState>(scenario);

    // Unstake both stake objects
    ls::unstake(&mut ls, &mut system_state, *staked_sui_id, test_scenario::ctx(scenario));
    test_scenario::return_shared(system_state);
    assert_eq!(ls::sui_balance(&ls), 100 * MIST_PER_SUI);
    assert_eq!(vec_map::length(ls::staked_sui(&ls)), 1);

    test_scenario::next_tx(scenario, @0x1);
    let (staked_sui_id, _) = vec_map::get_entry_by_idx(ls::staked_sui(&ls), 0);
    let mut system_state = test_scenario::take_shared<SuiSystemState>(scenario);
    ls::unstake(&mut ls, &mut system_state, *staked_sui_id, test_scenario::ctx(scenario));
    test_scenario::return_shared(system_state);
    assert_eq!(ls::sui_balance(&ls), 120 * MIST_PER_SUI);
    assert_eq!(vec_map::length(ls::staked_sui(&ls)), 0);

    destroy(ls);
    test_scenario::end(scenario_val);
}

#[test]
fun test_unlock_correct_epoch() {
    let mut scenario_val = test_scenario::begin(@0x0);
    let scenario = &mut scenario_val;

    set_up_sui_system_state(vector[@0x1, @0x2, @0x3]);

    let mut ls = ls::new(2, test_scenario::ctx(scenario));

    ls::deposit_sui(&mut ls, balance::create_for_testing(100 * MIST_PER_SUI));

    assert_eq!(ls::sui_balance(&ls), 100 * MIST_PER_SUI);

    test_scenario::next_tx(scenario, @0x1);
    let mut system_state = test_scenario::take_shared<SuiSystemState>(scenario);
    ls::stake(&mut ls, &mut system_state, 10 * MIST_PER_SUI, @0x1, test_scenario::ctx(scenario));
    test_scenario::return_shared(system_state);

    advance_epoch(scenario);
    advance_epoch(scenario);
    advance_epoch(scenario);
    advance_epoch(scenario);

    let (staked_sui, sui_balance) = ls::unlock(ls, test_scenario::ctx(scenario));
    assert_eq!(balance::value(&sui_balance), 90 * MIST_PER_SUI);
    assert_eq!(vec_map::length(&staked_sui), 1);

    destroy(staked_sui);
    destroy(sui_balance);
    test_scenario::end(scenario_val);
}

#[test]
#[expected_failure(abort_code = epoch_time_lock::EEpochNotYetEnded)]
fun test_unlock_incorrect_epoch() {
    let mut scenario_val = test_scenario::begin(@0x0);
    let scenario = &mut scenario_val;

    set_up_sui_system_state(vector[@0x1, @0x2, @0x3]);

    let ls = ls::new(2, test_scenario::ctx(scenario));
    let (staked_sui, sui_balance) = ls::unlock(ls, test_scenario::ctx(scenario));
    destroy(staked_sui);
    destroy(sui_balance);
    test_scenario::end(scenario_val);
}
`.trim(),
  };
}

export const MoveTemplate_Mysten_LockedStake: MoveTemplate = {
  id: 'mysten_locked_stake',
  label: 'MystenLabs: Locked Stake',
  defaultName: 'locked_stake',
  description: 'Locked staking',
  detail:
    'Stake and unstake while locked until epoch target, then unlock afterwards.',
  files,
};

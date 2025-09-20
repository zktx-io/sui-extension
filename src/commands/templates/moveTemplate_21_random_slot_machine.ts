import { FileMap, MoveTemplate, withCommon } from './types';

const README = withCommon(
  `
# Random Slot Machine (Mysten Labs)

Bet SUI against a shared game using Sui randomness (49% win, epoch-scoped game).

Source: https://github.com/MystenLabs/sui/tree/main/examples/move/random/slot_machine
`.trim(),
);

const moveToml = (pkg: string) =>
  `
[package]
name = "${pkg}"
version = "0.0.1"
edition = "2024.beta"

[dependencies]

[addresses]
${pkg} = "0x0"
`.trim();

const EXAMPLE_MOVE = (pkg: string) =>
  `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// A betting game that depends on Sui randomness.
///
/// Anyone can create a new game for the current epoch by depositing SUI as the initial balance. The creator can
/// withdraw the remaining balance after the epoch is over.
///
/// Anyone can play the game by betting on X SUI. They win X with probability 49% and lose the X SUI otherwise.
///
module ${pkg}::example;

use sui::balance::Balance;
use sui::coin::{Self, Coin};
use sui::random::{Random, new_generator};
use sui::sui::SUI;

/// Error codes
const EInvalidAmount: u64 = 0;
const EInvalidSender: u64 = 1;
const EInvalidEpoch: u64 = 2;

/// Game for a specific epoch.
public struct Game has key {
    id: UID,
    creator: address,
    epoch: u64,
    balance: Balance<SUI>,
}

/// Create a new game with a given initial reward for the current epoch.
public fun create(reward: Coin<SUI>, ctx: &mut TxContext) {
    let amount = reward.value();
    assert!(amount > 0, EInvalidAmount);
    transfer::share_object(Game {
        id: object::new(ctx),
        creator: ctx.sender(),
        epoch: ctx.epoch(),
        balance: reward.into_balance(),
    });
}

/// Creator can withdraw remaining balance if the game is over.
public fun close(game: Game, ctx: &mut TxContext): Coin<SUI> {
    assert!(ctx.epoch() > game.epoch, EInvalidEpoch);
    assert!(ctx.sender() == game.creator, EInvalidSender);
    let Game { id, creator: _, epoch: _, balance } = game;
    object::delete(id);
    balance.into_coin(ctx)
}

/// Play one turn of the game.
///
/// The function consumes the same amount of gas independently of the random outcome.
entry fun play(game: &mut Game, r: &Random, coin: &mut Coin<SUI>, ctx: &mut TxContext) {
    assert!(ctx.epoch() == game.epoch, EInvalidEpoch);
    assert!(coin.value() > 0, EInvalidAmount);

    // play the game
    let mut generator = new_generator(r, ctx);
    let bet = generator.generate_u8_in_range(1, 100);
    let lost = bet / 50; // 0 with probability 49%, and 1 or 2 with probability 51%
    let won = (2 - lost) / 2; // 1 with probability 49%, and 0 with probability 51%

    // move the bet amount from the user's coin to the game's balance
    let coin_value = coin.value();
    let bet_amount = coin_value.min(game.balance.value());
    coin::put(&mut game.balance, coin.split(bet_amount, ctx));

    // move the reward to the user's coin
    let reward = 2 * (won as u64) * bet_amount;
    // the assumption here is that the next line does not consumes more gas when called with zero reward than with
    // non-zero reward
    coin.join(coin::take(&mut game.balance, reward, ctx));
}

#[test_only]
public fun balance(game: &Game): u64 {
    game.balance.value()
}

#[test_only]
public fun epoch(game: &Game): u64 {
    game.epoch
}
`.trim();

const TESTS_MOVE = (pkg: string) =>
  `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

#[test_only]
module ${pkg}::tests;

use ${pkg}::example;
use sui::coin::{Self, Coin};
use sui::random::{Self, update_randomness_state_for_testing, Random};
use sui::sui::SUI;
use sui::test_scenario as ts;

fun mint(addr: address, amount: u64, scenario: &mut ts::Scenario) {
    transfer::public_transfer(coin::mint_for_testing<SUI>(amount, scenario.ctx()), addr);
    scenario.next_tx(addr);
}

#[test]
fun test_game() {
    let user1 = @0x0;
    let user2 = @0x1;
    let mut ts = ts::begin(user1);

    // Setup randomness
    random::create_for_testing(ts.ctx());
    ts.next_tx(user1);
    let mut random_state: Random = ts.take_shared();
    random_state.update_randomness_state_for_testing(
        0,
        x"1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F",
        ts.ctx(),
    );

    // Create the game and get back the output objects.
    mint(user1, 1000, &mut ts);
    let coin = ts.take_from_sender<Coin<SUI>>();
    example::create(coin, ts.ctx());
    ts.next_tx(user1);
    let mut game = ts.take_shared<example::Game>();
    assert!(game.balance() == 1000, 1);
    assert!(game.epoch() == 0, 1);

    // Play 4 turns (everything here is deterministic)
    ts.next_tx(user2);
    mint(user2, 100, &mut ts);
    let mut coin: Coin<SUI> = ts.take_from_sender();
    game.play(&random_state, &mut coin, ts.ctx());
    assert!(game.balance() == 1100, 1); // lost 100
    assert!(coin.value() == 0, 1);
    ts.return_to_sender(coin);

    ts.next_tx(user2);
    mint(user2, 200, &mut ts);
    let mut coin: Coin<SUI> = ts.take_from_sender();
    game.play(&random_state, &mut coin, ts.ctx());
    assert!(game.balance() == 900, 1); // won 200
    // check that received the right amount
    assert!(coin.value() == 400, 1);
    ts.return_to_sender(coin);

    ts.next_tx(user2);
    mint(user2, 300, &mut ts);
    let mut coin: Coin<SUI> = ts.take_from_sender();
    game.play(&random_state, &mut coin, ts.ctx());
    assert!(game.balance() == 600, 1); // won 300
    // check that received the remaining amount
    assert!(coin.value() == 600, 1);
    ts.return_to_sender(coin);

    ts.next_tx(user2);
    mint(user2, 200, &mut ts);
    let mut coin: Coin<SUI> = ts.take_from_sender();
    game.play(&random_state, &mut coin, ts.ctx());
    assert!(game.balance() == 800, 1); // lost 200
    // check that received the right amount
    assert!(coin.value() == 0, 1);
    ts.return_to_sender(coin);

    // TODO: test also that the last coin is taken

    // Take remaining balance
    ts.next_epoch(user1);
    let coin = game.close(ts.ctx());
    assert!(coin.value() == 800, 1);
    coin.burn_for_testing();

    ts::return_shared(random_state);
    ts.end();
}
`.trim();

function files(pkg: string): FileMap {
  return {
    'Move.toml': moveToml(pkg),
    'README.md': README,
    'sources/example.move': EXAMPLE_MOVE(pkg),
    'tests/example_tests.move': TESTS_MOVE(pkg),
  };
}

export const MoveTemplate_Mysten_Random_SlotMachine: MoveTemplate = {
  id: 'mysten_random_slot_machine',
  label: 'MystenLabs: Random Slot Machine',
  defaultName: 'slot_machine',
  description: 'Betting game with Sui randomness',
  detail:
    'Create epoch-scoped game, play bets (≈49% win), and close to withdraw leftover balance.',
  files,
};

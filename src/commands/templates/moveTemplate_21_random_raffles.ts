import { FileMap, MoveTemplate, withCommon } from './types';

const README = withCommon(
  `
# Random Raffles (Mysten Labs)

Two raffle examples that use Sui randomness.

- \`example1.move\`: Raffle with tickets (transferable).
- \`example2.move\`: Small raffle (no tickets), winners paid directly.

Source: https://github.com/MystenLabs/sui/tree/main/examples/move/random/raffles
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

const EXAMPLE1 = (pkg: string) =>
  `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// Basic raffle game that depends on Sui randomness.
///
/// Anyone can create a new raffle game with an end time and a price. After the end time, anyone can trigger
/// a function to determine the winner, and the winner gets the entire balance of the game.
///
/// Example 1: Uses tickets which could be transferred to other accounts, used as NFTs, etc.

module ${pkg}::example1;

use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::random::{Random, new_generator};
use sui::sui::SUI;

/// Error codes
const EGameInProgress: u64 = 0;
const EGameAlreadyCompleted: u64 = 1;
const EInvalidAmount: u64 = 2;
const EGameMismatch: u64 = 3;
const ENotWinner: u64 = 4;
const ENoParticipants: u64 = 5;

/// Game represents a set of parameters of a single game.
public struct Game has key {
    id: UID,
    cost_in_sui: u64,
    participants: u32,
    end_time: u64,
    winner: Option<u32>,
    balance: Balance<SUI>,
}

/// Ticket represents a participant in a single game.
public struct Ticket has key {
    id: UID,
    game_id: ID,
    participant_index: u32,
}

/// Create a shared-object Game.
public fun create(end_time: u64, cost_in_sui: u64, ctx: &mut TxContext) {
    let game = Game {
        id: object::new(ctx),
        cost_in_sui,
        participants: 0,
        end_time,
        winner: option::none(),
        balance: balance::zero(),
    };
    transfer::share_object(game);
}

/// Anyone can determine a winner.
///
/// The function is defined as private entry to prevent calls from other Move functions. (If calls from other
/// functions are allowed, the calling function might abort the transaction depending on the winner.)
/// Gas based attacks are not possible since the gas cost of this function is independent of the winner.
entry fun determine_winner(game: &mut Game, r: &Random, clock: &Clock, ctx: &mut TxContext) {
    assert!(game.end_time <= clock.timestamp_ms(), EGameInProgress);
    assert!(game.winner.is_none(), EGameAlreadyCompleted);
    assert!(game.participants > 0, ENoParticipants);
    let mut generator = r.new_generator(ctx);
    let winner = generator.generate_u32_in_range(1, game.participants);
    game.winner = option::some(winner);
}

/// Anyone can play and receive a ticket.
public fun buy_ticket(
    game: &mut Game,
    coin: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
): Ticket {
    assert!(game.end_time > clock.timestamp_ms(), EGameAlreadyCompleted);
    assert!(coin.value() == game.cost_in_sui, EInvalidAmount);

    game.participants = game.participants + 1;
    coin::put(&mut game.balance, coin);

    Ticket {
        id: object::new(ctx),
        game_id: object::id(game),
        participant_index: game.participants,
    }
}

/// The winner can take the prize.
public fun redeem(ticket: Ticket, game: Game, ctx: &mut TxContext): Coin<SUI> {
    assert!(object::id(&game) == ticket.game_id, EGameMismatch);
    assert!(game.winner.contains(&ticket.participant_index), ENotWinner);
    destroy_ticket(ticket);

    let Game { id, cost_in_sui: _, participants: _, end_time: _, winner: _, balance } = game;
    object::delete(id);
    let reward = balance.into_coin(ctx);
    reward
}

public use fun destroy_ticket as Ticket.destroy;

public fun destroy_ticket(ticket: Ticket) {
    let Ticket { id, game_id: _, participant_index: _ } = ticket;
    object::delete(id);
}

#[test_only]
public fun cost_in_sui(game: &Game): u64 { game.cost_in_sui }

#[test_only]
public fun end_time(game: &Game): u64 { game.end_time }

#[test_only]
public fun participants(game: &Game): u32 { game.participants }

#[test_only]
public fun winner(game: &Game): Option<u32> { game.winner }

#[test_only]
public fun balance(game: &Game): u64 { game.balance.value() }
`.trim();

const EXAMPLE2 = (pkg: string) =>
  `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// Basic raffles game that depends on Sui randomness.
///
/// Anyone can create a new raffle game with an end time and a price. After the end time, anyone can trigger
/// a function to determine the winner, and the winner gets the entire balance of the game.
///
/// Example 2: Small raffle, without tickets.

module ${pkg}::example2;

use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::random::{Random, new_generator};
use sui::sui::SUI;
use sui::table_vec::{Self, TableVec};
use sui::tx_context::sender;

/// Error codes
const EGameInProgress: u64 = 0;
const EGameAlreadyCompleted: u64 = 1;
const EInvalidAmount: u64 = 2;
const EReachedMaxParticipants: u64 = 3;

const MaxParticipants: u32 = 500;

/// Game represents a set of parameters of a single game.
public struct Game has key {
    id: UID,
    cost_in_sui: u64,
    participants: u32,
    end_time: u64,
    balance: Balance<SUI>,
    participants_table: TableVec<address>,
}

/// Create a shared-object Game.
public fun create(end_time: u64, cost_in_sui: u64, ctx: &mut TxContext) {
    let game = Game {
        id: object::new(ctx),
        cost_in_sui,
        participants: 0,
        end_time,
        balance: balance::zero(),
        participants_table: table_vec::empty(ctx),
    };
    transfer::share_object(game);
}

/// Anyone can close the game and send the balance to the winner.
///
/// The function is defined as private entry to prevent calls from other Move functions. (If calls from other
/// functions are allowed, the calling function might abort the transaction depending on the winner.)
/// Gas based attacks are not possible since the gas cost of this function is independent of the winner.
entry fun close(game: Game, r: &Random, clock: &Clock, ctx: &mut TxContext) {
    assert!(game.end_time <= clock.timestamp_ms(), EGameInProgress);
    let Game { id, cost_in_sui: _, participants, end_time: _, balance, participants_table } = game;
    if (participants > 0) {
        let mut generator = r.new_generator(ctx);
        let winner = generator.generate_u32_in_range(0, participants - 1);
        let winner_address = participants_table[winner as u64];
        let reward = coin::from_balance(balance, ctx);
        transfer::public_transfer(reward, winner_address);
    } else {
        balance.destroy_zero();
    };

    participants_table.drop();
    object::delete(id);
}

/// Anyone can play.
public fun play(game: &mut Game, coin: Coin<SUI>, clock: &Clock, ctx: &mut TxContext) {
    assert!(game.end_time > clock.timestamp_ms(), EGameAlreadyCompleted);
    assert!(coin.value() == game.cost_in_sui, EInvalidAmount);
    assert!(game.participants < MaxParticipants, EReachedMaxParticipants);

    coin::put(&mut game.balance, coin);
    game.participants_table.push_back(ctx.sender());
    game.participants = game.participants + 1;
}

#[test_only]
public fun cost_in_sui(game: &Game): u64 { game.cost_in_sui }

#[test_only]
public fun end_time(game: &Game): u64 { game.end_time }

#[test_only]
public fun participants(game: &Game): u32 { game.participants }

#[test_only]
public fun balance(game: &Game): u64 { game.balance.value() }
`.trim();

const TESTS = (pkg: string) =>
  `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

#[test_only]
module ${pkg}::tests;

use ${pkg}::example1;
use ${pkg}::example2;
use sui::clock;
use sui::coin::{Self, Coin};
use sui::random::{Self, update_randomness_state_for_testing, Random};
use sui::sui::SUI;
use sui::test_scenario as ts;

fun mint(addr: address, amount: u64, scenario: &mut ts::Scenario) {
    transfer::public_transfer(coin::mint_for_testing<SUI>(amount, scenario.ctx()), addr);
    scenario.next_tx(addr);
}

#[test]
fun test_example1() {
    let user1 = @0x0;
    let user2 = @0x1;
    let user3 = @0x2;
    let user4 = @0x3;
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
    let end_time = 100;
    example1::create(end_time, 10, ts.ctx());
    ts.next_tx(user1);
    let mut game: example1::Game = ts.take_shared();
    assert!(game.cost_in_sui() == 10, 1);
    assert!(game.participants() == 0, 1);
    assert!(game.end_time() == end_time, 1);
    assert!(game.winner() == option::none(), 1);
    assert!(game.balance() == 0, 1);

    let mut clock = clock::create_for_testing(ts.ctx());
    clock.set_for_testing(10);

    // Play with 4 users (everything here is deterministic)
    ts.next_tx(user1);
    mint(user1, 10, &mut ts);
    let coin: Coin<SUI> = ts.take_from_sender();
    let t1 = game.buy_ticket(coin, &clock, ts.ctx());
    assert!(game.participants() == 1, 1);
    t1.destroy(); // loser

    ts.next_tx(user2);
    mint(user2, 10, &mut ts);
    let coin: Coin<SUI> = ts.take_from_sender();
    let t2 = game.buy_ticket(coin, &clock, ts.ctx());
    assert!(game.participants() == 2, 1);
    t2.destroy(); // loser

    ts.next_tx(user3);
    mint(user3, 10, &mut ts);
    let coin: Coin<SUI> = ts.take_from_sender();
    let t3 = game.buy_ticket(coin, &clock, ts.ctx());
    assert!(game.participants() == 3, 1);
    t3.destroy(); // loser

    ts.next_tx(user4);
    mint(user4, 10, &mut ts);
    let coin: Coin<SUI> = ts.take_from_sender();
    let t4 = game.buy_ticket(coin, &clock, ts.ctx());
    assert!(game.participants() == 4, 1);
    // this is the winner

    // Determine the winner (-> user4)
    clock.set_for_testing(101);
    game.determine_winner(&random_state, &clock, ts.ctx());
    assert!(game.winner() == option::some(4), 1);
    assert!(game.balance() == 40, 1);
    clock.destroy_for_testing();

    // Take the reward
    let coin = t4.redeem(game, ts.ctx());
    assert!(coin.value() == 40, 1);
    coin.burn_for_testing();

    ts::return_shared(random_state);
    ts.end();
}

#[test]
fun test_example2() {
    let user1 = @0x0;
    let user2 = @0x1;
    let user3 = @0x2;
    let user4 = @0x3;

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
    let end_time = 100;
    example2::create(end_time, 10, ts.ctx());
    ts.next_tx(user1);
    let mut game: example2::Game = ts.take_shared();
    assert!(game.cost_in_sui() == 10, 1);
    assert!(game.participants() == 0, 1);
    assert!(game.end_time() == end_time, 1);
    assert!(game.balance() == 0, 1);

    let mut clock = clock::create_for_testing(ts.ctx());
    clock.set_for_testing(10);

    // Play with 4 users (everything here is deterministic)
    ts.next_tx(user1);
    mint(user1, 10, &mut ts);
    let coin: Coin<SUI> = ts.take_from_sender();
    game.play(coin, &clock, ts.ctx());
    assert!(game.participants() == 1, 1);

    ts.next_tx(user2);
    mint(user2, 10, &mut ts);
    let coin: Coin<SUI> = ts.take_from_sender();
    game.play(coin, &clock, ts.ctx());
    assert!(game.participants() == 2, 1);

    ts.next_tx(user3);
    mint(user3, 10, &mut ts);
    let coin: Coin<SUI> = ts.take_from_sender();
    game.play(coin, &clock, ts.ctx());
    assert!(game.participants() == 3, 1);

    ts.next_tx(user4);
    mint(user4, 10, &mut ts);
    let coin: Coin<SUI> = ts.take_from_sender();
    game.play(coin, &clock, ts.ctx());
    assert!(game.participants() == 4, 1);

    // Determine the winner (-> user4)
    clock.set_for_testing(101);
    game.close(&random_state, &clock, ts.ctx());
    clock.destroy_for_testing();

    // Check that received the reward
    ts.next_tx(user4);
    let coin: Coin<SUI> = ts.take_from_sender();
    assert!(coin.value() == 40, 1);
    coin.burn_for_testing();

    ts::return_shared(random_state);
    ts.end();
}
`.trim();

function files(pkg: string): FileMap {
  return {
    'Move.toml': moveToml(pkg),
    'README.md': README,
    'sources/example1.move': EXAMPLE1(pkg),
    'sources/example2.move': EXAMPLE2(pkg),
    'tests/example_tests.move': TESTS(pkg),
  };
}

export const MoveTemplate_Mysten_Random_Raffles: MoveTemplate = {
  id: 'mysten_random_raffles',
  label: 'MystenLabs: Random Raffles',
  defaultName: 'raffles',
  description: 'Raffle games using Sui randomness',
  detail:
    'Two examples: ticket-based and ticketless raffles. Create, play, and pick winners fairly.',
  files,
};

import { FileMap, MoveTemplate, withCommon } from './types';

const README = withCommon(`
# MystenLabs Example: VDF Lottery

A lottery that aggregates user-provided randomness and finalizes with a **Verifiable Delay Function (VDF)**:
- Users buy tickets during a submission window; randomness is hashed into a seed
- After the window, anyone submits a VDF output + proof to finalize
- Winner is selected from the VDF-derived randomness

Source: https://github.com/MystenLabs/sui/tree/main/examples/move/vdf
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

    'sources/lottery.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// A basic lottery game that depends on user-provided randomness which is processed by a verifiable
/// delay function (VDF) to make sure that it is unbiasable.
module ${pkg}::lottery;

use std::hash::sha2_256;
use sui::clock::Clock;
use sui::vdf::{hash_to_input, vdf_verify};

// === Receiver Functions ===

public use fun delete_ticket as Ticket.delete;
public use fun delete_game_winner as GameWinner.delete;
public use fun ticket_game_id as Ticket.game_id;
public use fun game_winner_game_id as GameWinner.game_id;

// === Object Types ===

/// Game represents a set of parameters of a single game.
/// This game can be extended to require ticket purchase, reward winners, etc.
public struct Game has key {
    id: UID,
    iterations: u64,
    status: u8,
    timestamp_start: u64,
    submission_phase_length: u64,
    participants: u64,
    vdf_input_seed: vector<u8>,
    winner: Option<u64>,
}

/// Ticket represents a participant in a single game.
/// Can be deconstructed only by the owner.
public struct Ticket has key, store {
    id: UID,
    game_id: ID,
    participant_index: u64,
}

/// GameWinner represents a participant that won in a specific game.
/// Can be deconstructed only by the owner.
public struct GameWinner has key, store {
    id: UID,
    game_id: ID,
}

// === Error Codes ===

#[error]
const EGameNotInProgress: vector<u8> = b"Lottery not in progress, cannot participate.";

#[error]
const EGameAlreadyCompleted: vector<u8> = b"Lottery winner has already been selected";

#[error]
const EInvalidTicket: vector<u8> = b"Ticket does not match lottery";

#[error]
const ENotWinner: vector<u8> = b"Not the winning ticket";

#[error]
const ESubmissionPhaseInProgress: vector<u8> =
    b"Cannot call winner or redeem funds until submission phase has completed.";

#[error]
const EInvalidVdfProof: vector<u8> = b"Invalid VDF Proof";

#[error]
const ESubmissionPhaseFinished: vector<u8> = b"Cannot participate in a finished lottery.";

#[error]
const EInvalidRandomness: vector<u8> = b"Randomness length is not correct";

// === Constants ===

// Game status
const IN_PROGRESS: u8 = 0;
const COMPLETED: u8 = 1;

const RANDOMNESS_LENGTH: u64 = 16;

// === Public Functions ===

/// Create a shared-object Game.
public fun create(
    iterations: u64,
    submission_phase_length: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    transfer::share_object(Game {
        id: object::new(ctx),
        iterations,
        status: IN_PROGRESS,
        timestamp_start: clock.timestamp_ms(),
        submission_phase_length,
        vdf_input_seed: vector::empty<u8>(),
        participants: 0,
        winner: option::none(),
    });
}

/// Anyone can participate in the game and receive a ticket.
public fun participate(
    self: &mut Game,
    my_randomness: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
): Ticket {
    assert!(self.status == IN_PROGRESS, EGameNotInProgress);
    assert!(
        clock.timestamp_ms() - self.timestamp_start < self.submission_phase_length,
        ESubmissionPhaseFinished,
    );

    // Update combined randomness by concatenating the provided randomness and hashing it
    assert!(my_randomness.length() == RANDOMNESS_LENGTH, EInvalidRandomness);
    self.vdf_input_seed.append(my_randomness);
    self.vdf_input_seed = sha2_256(self.vdf_input_seed);

    // Assign index to this participant
    let participant_index = self.participants;
    self.participants = self.participants + 1;

    Ticket {
        id: object::new(ctx),
        game_id: object::id(self),
        participant_index,
    }
}

/// Complete this lottery by sending VDF output and proof for the seed created from the
/// contributed randomness. Anyone can call this.
public fun complete(self: &mut Game, vdf_output: vector<u8>, vdf_proof: vector<u8>, clock: &Clock) {
    assert!(self.status != COMPLETED, EGameAlreadyCompleted);
    assert!(
        clock.timestamp_ms() - self.timestamp_start >= self.submission_phase_length,
        ESubmissionPhaseInProgress,
    );

    // Hash combined randomness to vdf input
    let vdf_input = hash_to_input(&self.vdf_input_seed);

    // Verify output and proof
    assert!(vdf_verify(&vdf_input, &vdf_output, &vdf_proof, self.iterations), EInvalidVdfProof);

    // Derive uniform randomness from the VDF output
    let randomness = sha2_256(vdf_output);

    // Set winner and mark lottery completed
    self.winner = option::some(safe_selection(self.participants, &randomness));
    self.status = COMPLETED;
}

/// The winner can redeem its ticket.
public fun redeem(self: &Game, ticket: &Ticket, ctx: &mut TxContext): GameWinner {
    assert!(self.status == COMPLETED, ESubmissionPhaseInProgress);
    assert!(object::id(self) == ticket.game_id, EInvalidTicket);
    assert!(self.winner.contains(&ticket.participant_index), ENotWinner);

    GameWinner {
        id: object::new(ctx),
        game_id: ticket.game_id,
    }
}

// Note that a ticket can be deleted before the game was completed.
public fun delete_ticket(ticket: Ticket) {
    let Ticket { id, game_id: _, participant_index: _ } = ticket;
    object::delete(id);
}

public fun delete_game_winner(ticket: GameWinner) {
    let GameWinner { id, game_id: _ } = ticket;
    object::delete(id);
}

public fun ticket_game_id(ticket: &Ticket): &ID {
    &ticket.game_id
}

public fun game_winner_game_id(ticket: &GameWinner): &ID {
    &ticket.game_id
}

// === Private Helpers ===

/// Converts the first 16 bytes of \`rnd\` to a u128 and returns modulo \`n\`.
/// Since \`n\` is u64, the result is at most 2^{-64} biased if \`rnd\` is uniform.
fun safe_selection(n: u64, rnd: &vector<u8>): u64 {
    assert!(rnd.length() >= 16, EInvalidRandomness);
    let mut m: u128 = 0;
    let mut i = 0;
    while (i < 16) {
        m = m << 8;
        let curr_byte = rnd[i];
        m = m + (curr_byte as u128);
        i = i + 1;
    };
    let n_128 = (n as u128);
    let module_128 = m % n_128;
    let res = (module_128 as u64);
    res
}
`.trim(),

    'tests/lottery_tests.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

#[test_only]
module ${pkg}::lottery_tests;

use sui::clock;
use sui::test_scenario as ts;
use ${pkg}::lottery::{Self, Game, GameWinner};

const OUTPUT: vector<u8> =
    x"c00139196755e0b5...33a36c3c";

const PROOF: vector<u8> =
    x"c0014c3726e4a8b4...6fd6c99402ea00c184eee44d282b622d8fd26";

const BAD_PROOF: vector<u8> =
    x"0101010180032cf3...c10397349ddc8cc8452ec";

#[test]
#[expected_failure(abort_code = ${pkg}::lottery::ESubmissionPhaseInProgress)]
fun test_complete_too_early() {
    let user1 = @0x0;

    let mut ts = ts::begin(user1);
    let mut clock = clock::create_for_testing(ts.ctx());

    lottery::create(1000, 1000, &clock, ts.ctx());
    ts.next_tx(user1);
    let mut game: Game = ts.take_shared();

    // User 1 buys a ticket.
    ts.next_tx(user1);
    let _t1 = game.participate(b"user1 randomness", &clock, ts.ctx());

    // Increment time but still in submission phase
    clock.increment_for_testing(500);

    // User1 tries to complete the lottery too early.
    ts.next_tx(user1);
    game.complete(OUTPUT, PROOF, &clock);
    abort 0
}

#[test]
fun test_play_vdf_lottery() {
    let user1 = @0x0;
    let user2 = @0x1;
    let user3 = @0x2;
    let user4 = @0x3;

    let mut ts = ts::begin(user1);
    let mut clock = clock::create_for_testing(ts.ctx());

    lottery::create(1000, 1000, &clock, ts.ctx());
    ts.next_tx(user1);
    let mut game: Game = ts.take_shared();

    // User 1 buys a ticket.
    ts.next_tx(user1);
    let t1 = game.participate(b"user1 randomness", &clock, ts.ctx());

    // User 2 buys a ticket.
    ts.next_tx(user2);
    let t2 = game.participate(b"user2 randomness", &clock, ts.ctx());

    // User 3 buys a ticket
    ts.next_tx(user3);
    let t3 = game.participate(b"user3 randomness", &clock, ts.ctx());

    // User 4 buys a ticket
    ts.next_tx(user4);
    let t4 = game.participate(b"user4 randomness", &clock, ts.ctx());

    // Increment time to after submission phase has ended
    clock.increment_for_testing(1000);

    // User 3 completes by submitting output and proof of the VDF
    ts.next_tx(user3);
    game.complete(OUTPUT, PROOF, &clock);

    // User 2 is the winner since the mod of the hash results in 1.
    ts.next_tx(user2);
    assert!(!ts::has_most_recent_for_address<GameWinner>(user2), 1);
    let winner = game.redeem(&t2, ts.ctx());

    // Make sure User2 now has a winner ticket for the right game id.
    ts.next_tx(user2);
    assert!(winner.game_id() == t2.game_id(), 1);

    t1.delete();
    t2.delete();
    t3.delete();
    t4.delete();
    winner.delete();

    clock.destroy_for_testing();
    ts::return_shared(game);
    ts.end();
}

#[test]
#[expected_failure(abort_code = ${pkg}::lottery::EInvalidVdfProof)]
fun test_invalid_vdf_output() {
    let user1 = @0x0;
    let user2 = @0x1;
    let user3 = @0x2;
    let user4 = @0x3;

    let mut ts = ts::begin(user1);
    let mut clock = clock::create_for_testing(ts.ctx());

    lottery::create(1000, 1000, &clock, ts.ctx());
    ts.next_tx(user1);
    let mut game: Game = ts.take_shared();

    // User1 buys a ticket.
    ts.next_tx(user1);
    let _t1 = game.participate(b"user1 randomness", &clock, ts.ctx());
    // User2 buys a ticket.
    ts.next_tx(user2);
    let _t2 = game.participate(b"user2 randomness", &clock, ts.ctx());
    // User3 buys a ticket
    ts.next_tx(user3);
    let _t3 = game.participate(b"user3 randomness", &clock, ts.ctx());
    // User4 buys a ticket
    ts.next_tx(user4);
    let _t4 = game.participate(b"user4 randomness", &clock, ts.ctx());

    // Increment time to after submission phase has ended
    clock.increment_for_testing(1000);

    // User3 completes by submitting output and proof of the VDF
    ts.next_tx(user3);
    game.complete(OUTPUT, BAD_PROOF, &clock);
    abort 0
}

#[test]
#[expected_failure(abort_code = ${pkg}::lottery::EInvalidRandomness)]
fun test_empty_randomness() {
    let user1 = @0x0;

    let mut ts = ts::begin(user1);
    let clock = clock::create_for_testing(ts.ctx());

    lottery::create(1000, 1000, &clock, ts.ctx());
    ts.next_tx(user1);
    let mut game: Game = ts.take_shared();

    // User1 buys a ticket, but with wrong randomness length.
    ts.next_tx(user1);
    let _t = game.participate(b"abcd", &clock, ts.ctx());
    abort 0
}
`.trim(),
  };
}

export const MoveTemplate_Mysten_VDF_Lottery: MoveTemplate = {
  id: 'mysten_vdf',
  label: 'MystenLabs: VDF Lottery',
  defaultName: 'vdf',
  description: 'VDF lottery game',
  detail:
    'Players add randomness; after window, VDF proof finalizes and winner is chosen.',
  files,
};

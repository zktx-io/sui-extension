import { FileMap, MoveTemplate, withCommon } from './types';

const README = withCommon(`
# Basics Examples (Mysten Labs)

This package contains multiple basics examples from Mysten Labs:

- \`clock.move\`: Access the on-chain clock and emit timestamp
- \`counter.move\`: Shared counter (create, increment, reset, delete)
- \`object_basics.move\`: Basic object operations (create, transfer, update, wrap/unwrap, delete)
- \`random.move\`: Emit random u128 values using Random
- \`resolve_args.move\`: Functions to test argument resolution in JSON-RPC

Source: https://github.com/MystenLabs/sui/tree/main/examples/move/basics
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

    'sources/clock.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::clock;

use sui::clock::Clock;
use sui::event;

public struct TimeEvent has copy, drop, store {
    timestamp_ms: u64,
}

entry fun access(clock: &Clock) {
    event::emit(TimeEvent { timestamp_ms: clock.timestamp_ms() });
}
`.trim(),

    'sources/counter.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// This example demonstrates a basic use of a shared object.
module ${pkg}::counter {
    public struct Counter has key {
        id: UID,
        owner: address,
        value: u64,
    }

    public fun owner(counter: &Counter): address { counter.owner }
    public fun value(counter: &Counter): u64 { counter.value }

    public fun create(ctx: &mut TxContext) {
        transfer::share_object(Counter { id: object::new(ctx), owner: ctx.sender(), value: 0 })
    }

    public fun increment(counter: &mut Counter) { counter.value = counter.value + 1; }

    public fun set_value(counter: &mut Counter, value: u64, ctx: &TxContext) {
        assert!(counter.owner == ctx.sender());
        counter.value = value;
    }

    public fun assert_value(counter: &Counter, value: u64) {
        assert!(counter.value == value, 0)
    }

    public fun delete(counter: Counter, ctx: &TxContext) {
        assert!(counter.owner == ctx.sender());
        let Counter { id, owner: _, value: _ } = counter;
        id.delete();
    }
}

#[test_only]
module ${pkg}::counter_test {
    use ${pkg}::counter::{Self, Counter};
    use sui::test_scenario as ts;

    #[test]
    fun test_counter() {
        let owner = @0xC0FFEE;
        let user1 = @0xA1;
        let mut ts = ts::begin(user1);

        { ts.next_tx(owner); counter::create(ts.ctx()); };
        { ts.next_tx(user1);
          let mut counter: Counter = ts.take_shared();
          assert!(counter.owner() == owner);
          assert!(counter.value() == 0);
          counter.increment(); counter.increment(); counter.increment();
          ts::return_shared(counter); };
        { ts.next_tx(owner);
          let mut counter: Counter = ts.take_shared();
          assert!(counter.value() == 3);
          counter.set_value(100, ts.ctx());
          ts::return_shared(counter); };
        { ts.next_tx(user1);
          let mut counter: Counter = ts.take_shared();
          assert!(counter.value() == 100);
          counter.increment();
          assert!(counter.value() == 101);
          ts::return_shared(counter); };

        ts.end();
    }
}
`.trim(),

    'sources/object_basics.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::object_basics;

use sui::event;
use sui::party;

public struct Object has key, store { id: UID, value: u64 }
public struct Wrapper has key { id: UID, o: Object }
public struct NewValueEvent has copy, drop { new_value: u64 }

public fun create(value: u64, recipient: address, ctx: &mut TxContext) {
    transfer::public_transfer(Object { id: object::new(ctx), value }, recipient)
}

public fun create_party(value: u64, recipient: address, ctx: &mut TxContext) {
    let party = party::single_owner(recipient);
    transfer::public_party_transfer(Object { id: object::new(ctx), value }, party)
}

public fun transfer(o: Object, recipient: address) {
    transfer::public_transfer(o, recipient)
}

public fun party_transfer_single_owner(o: Object, recipient: address) {
    let party = party::single_owner(recipient);
    transfer::public_party_transfer(o, party)
}

public fun freeze_object(o: Object) { transfer::public_freeze_object(o) }

public fun set_value(o: &mut Object, value: u64) { o.value = value; }

public fun get_value(o: &Object): u64 { o.value }

public fun update(o1: &mut Object, o2: &Object) {
    o1.value = o2.value;
    event::emit(NewValueEvent { new_value: o2.value })
}

public fun delete(o: Object) {
    let Object { id, value: _ } = o; id.delete();
}

public fun wrap(o: Object, ctx: &mut TxContext) {
    transfer::transfer(Wrapper { id: object::new(ctx), o }, ctx.sender());
}

#[lint_allow(self_transfer)]
public fun unwrap(w: Wrapper, ctx: &TxContext) {
    let Wrapper { id, o } = w;
    id.delete();
    transfer::public_transfer(o, ctx.sender());
}
`.trim(),

    'sources/random.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::random;

use sui::event;
use sui::random::Random;

public struct RandomU128Event has copy, drop { value: u128 }

entry fun new(r: &Random, ctx: &mut TxContext) {
    let mut gen = r.new_generator(ctx);
    let value = gen.generate_u128();
    event::emit(RandomU128Event { value });
}
`.trim(),

    'sources/resolve_args.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::resolve_args;

public struct Foo has key { id: UID }

public fun foo(
    _foo: &mut Foo,
    _bar: vector<Foo>,
    _name: vector<u8>,
    _index: u64,
    _flag: u8,
    _recipient: address,
    _ctx: &mut TxContext,
) { abort 0 }
`.trim(),

    'README.md': README,
  };
}

export const MoveTemplate_Mysten_Basics: MoveTemplate = {
  id: 'mysten_basics',
  label: 'MystenLabs: Basics Examples',
  defaultName: 'basics',
  description: 'Basic examples',
  detail:
    'Includes Clock, Counter, Object basics, Random, and Resolve Args modules.',
  files,
};

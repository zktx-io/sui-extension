import { FileMap, MoveTemplate, withCommon } from './types';

const README = withCommon(`
# First Package (Mysten Labs)

A minimal first Move package showing:
- Module initializer (\`init\`) that mints a \`Forge\` to the publisher
- A \`Sword\` object with fields and accessors
- Constructors (\`sword_create\`, \`new_sword\`)
- Tests for creation, transfer, and module initialization

Source: https://github.com/MystenLabs/sui/tree/main/examples/move/first_package
`);

const moveToml = (pkg: string) =>
  `
[package]
name = "${pkg}"
edition = "2024.beta" # edition = "legacy" to use legacy (pre-2024) Move
# license = ""           # e.g., "MIT", "GPL", "Apache 2.0"
# authors = ["..."]      # e.g., ["Joe Smith (joesmith@noemail.com)", "John Snow (johnsnow@noemail.com)"]

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

# Named addresses will be accessible in Move as \`@name\`. They're also exported:
# for example, \`std = "0x1"\` is exported by the Standard Library.
# alice = "0xA11CE"

[dev-dependencies]
# The dev-dependencies section allows overriding dependencies for \`--test\` and
# \`--dev\` modes. You can introduce test-only dependencies here.
# Local = { local = "../path/to/dev-build" }

[dev-addresses]
# The dev-addresses section allows overwriting named addresses for the \`--test\`
# and \`--dev\` modes.
# alice = "0xB0B"
`.trim();

function files(pkg: string): FileMap {
  return {
    'Move.toml': moveToml(pkg),
    'README.md': README,

    'sources/example.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

// docs::#first
module ${pkg}::example;

// Part 1: These imports are provided by default
// use sui::object::{Self, UID};
// use sui::transfer;
// use sui::tx_context::{Self, TxContext};

// Part 2: struct definitions
public struct Sword has key, store {
    id: UID,
    magic: u64,
    strength: u64,
}

public struct Forge has key {
    id: UID,
    swords_created: u64,
}

// Part 3: Module initializer to be executed when this module is published
fun init(ctx: &mut TxContext) {
    let admin = Forge {
        id: object::new(ctx),
        swords_created: 0,
    };

    // Transfer the forge object to the module/package publisher
    transfer::transfer(admin, ctx.sender());
}

// Part 4: Accessors required to read the struct fields
public fun magic(self: &Sword): u64 {
    self.magic
}

public fun strength(self: &Sword): u64 {
    self.strength
}

public fun swords_created(self: &Forge): u64 {
    self.swords_created
}

// Part 5: Public/entry functions (introduced later in the tutorial)
// docs::#first-pause
public fun sword_create(magic: u64, strength: u64, ctx: &mut TxContext): Sword {
    // Create a sword
    Sword {
        id: object::new(ctx),
        magic: magic,
        strength: strength,
    }
}

/// Constructor for creating swords
public fun new_sword(forge: &mut Forge, magic: u64, strength: u64, ctx: &mut TxContext): Sword {
    forge.swords_created = forge.swords_created + 1;
    Sword {
        id: object::new(ctx),
        magic: magic,
        strength: strength,
    }
}
// docs::#first-resume
// Part 6: Tests

// docs::#first-test
#[test]
fun test_sword_create() {
    // Create a dummy TxContext for testing
    let mut ctx = tx_context::dummy();

    // Create a sword
    let sword = Sword {
        id: object::new(&mut ctx),
        magic: 42,
        strength: 7,
    };

    // Check if accessor functions return correct values
    assert!(sword.magic() == 42 && sword.strength() == 7, 1);

    // docs::/#first-test}

    // docs::#test-dummy
    // Create a dummy address and transfer the sword
    let dummy_address = @0xCAFE;
    transfer::public_transfer(sword, dummy_address);
    // docs::/#test-dummy
}

#[test]
fun test_sword_transactions() {
    use sui::test_scenario;

    // Create test addresses representing users
    let initial_owner = @0xCAFE;
    let final_owner = @0xFACE;

    // First transaction executed by initial owner to create the sword
    let mut scenario = test_scenario::begin(initial_owner);
    {
        // Create the sword and transfer it to the initial owner
        let sword = sword_create(42, 7, scenario.ctx());
        transfer::public_transfer(sword, initial_owner);
    };

    // Second transaction executed by the initial sword owner
    scenario.next_tx(initial_owner);
    {
        // Extract the sword owned by the initial owner
        let sword = scenario.take_from_sender<Sword>();
        // Transfer the sword to the final owner
        transfer::public_transfer(sword, final_owner);
    };

    // Third transaction executed by the final sword owner
    scenario.next_tx(final_owner);
    {
        // Extract the sword owned by the final owner
        let sword = scenario.take_from_sender<Sword>();
        // Verify that the sword has expected properties
        assert!(sword.magic() == 42 && sword.strength() == 7, 1);
        // Return the sword to the object pool (it cannot be simply "dropped")
        scenario.return_to_sender(sword)
    };
    scenario.end();
}

#[test]
fun test_module_init() {
    use sui::test_scenario;

    // Create test addresses representing users
    let admin = @0xAD;
    let initial_owner = @0xCAFE;

    // First transaction to emulate module initialization
    let mut scenario = test_scenario::begin(admin);
    {
        init(scenario.ctx());
    };

    // Second transaction to check if the forge has been created
    // and has initial value of zero swords created
    scenario.next_tx(admin);
    {
        // Extract the Forge object
        let forge = scenario.take_from_sender<Forge>();
        // Verify number of created swords
        assert!(forge.swords_created() == 0, 1);
        // Return the Forge object to the object pool
        scenario.return_to_sender(forge);
    };

    // Third transaction executed by admin to create the sword
    scenario.next_tx(admin);
    {
        let mut forge = scenario.take_from_sender<Forge>();
        // Create the sword and transfer it to the initial owner
        let sword = forge.new_sword(42, 7, scenario.ctx());
        transfer::public_transfer(sword, initial_owner);
        scenario.return_to_sender(forge);
    };
    scenario.end();
}
// docs::/#first
`.trim(),
  };
}

export const MoveTemplate_Mysten_FirstPackage: MoveTemplate = {
  id: 'mysten_first_package',
  label: 'MystenLabs: First Package',
  defaultName: 'my_first_package',
  description: 'First Move package',
  detail:
    'Module init, object types, constructors, and simple scenario tests included.',
  files,
};

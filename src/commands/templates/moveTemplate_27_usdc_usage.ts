import { FileMap, MoveTemplate, withCommon } from './types';

const README = withCommon(`
# MystenLabs Example: USDC Usage

Demonstrates accepting **USDC** (from Circle's official package), **SUI**, or an **arbitrary Coin<T>** as payment to mint a game item (\\\`Sword\\\`):
- Shows typed payment flows for \`Coin<USDC>\` and \`Coin<SUI>\`
- Shows a generic entry that accepts \`Coin<CoinType>\`
- Highlights external dependency usage via Circle's USDC package

Source: https://github.com/MystenLabs/sui/tree/main/examples/move/usdc_usage
Circle USDC package: https://github.com/circlefin/stablecoin-sui (packages/usdc)
`);

const moveToml = (pkg: string) =>
  `
[package]
name = "${pkg}"
edition = "2024.beta"

[dependencies]
usdc = { git = "https://github.com/circlefin/stablecoin-sui.git", subdir = "packages/usdc", rev = "master" }

# For remote import, use the \`{ git = "...", subdir = "...", rev = "..." }\`.
# Revision can be a branch, a tag, and a commit hash.
# MyRemotePackage = { git = "https://some.remote/host.git", subdir = "remote/path", rev = "main" }

# For local dependencies use \`local = path\`. Path is relative to the package root
# Local = { local = "../path/to" }

# To resolve a version conflict and force a specific version for dependency
# override use \`override = true\`
# Override = { local = "../conflicting/version", override = true }

# --- Required for this template ---
# Sui framework (let your build toolchain resolve the path/version)
# Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "main" }

# Circle USDC package (official)
usdc = { git = "https://github.com/circlefin/stablecoin-sui.git", subdir = "packages/usdc", rev = "master" }

[addresses]
${pkg} = "0x0"
`.trim();

function files(pkg: string): FileMap {
  return {
    'Move.toml': moveToml(pkg),
    'README.md': README,

    'sources/example.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::example;

use sui::coin::Coin;
use sui::sui::SUI;
use usdc::usdc::USDC;

public struct Sword has key, store {
    id: UID,
    strength: u64,
}

public fun buy_sword_with_usdc(coin: Coin<USDC>, ctx: &mut TxContext): Sword {
    let sword = create_sword(coin.value(), ctx);
    // In production: transfer to actual recipient! Don't transfer to 0x0!
    transfer::public_transfer(coin, @0x0);
    sword
}

public fun buy_sword_with_sui(coin: Coin<SUI>, ctx: &mut TxContext): Sword {
    let sword = create_sword(coin.value(), ctx);
    // In production: transfer to actual recipient! Don't transfer to 0x0!
    transfer::public_transfer(coin, @0x0);
    sword
}

public fun buy_sword_with_arbitrary_coin<CoinType>(
    coin: Coin<CoinType>,
    ctx: &mut TxContext,
): Sword {
    let sword = create_sword(coin.value(), ctx);
    // In production: transfer to actual recipient! Don't transfer to 0x0!
    transfer::public_transfer(coin, @0x0);
    sword
}

/// A helper function to create a sword.
fun create_sword(strength: u64, ctx: &mut TxContext): Sword {
    let id = object::new(ctx);
    Sword { id, strength }
}
`.trim(),
  };
}

export const MoveTemplate_Mysten_USDC_Usage: MoveTemplate = {
  id: 'mysten_usdc_usage',
  label: 'MystenLabs: USDC Usage',
  defaultName: 'usdc_usage',
  description: 'USDC payment demo',
  detail:
    'Buy a sword using USDC, SUI, or generic Coin<T>. Includes Circle USDC dep.',
  files,
};

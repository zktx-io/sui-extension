import { FileMap, MoveTemplate, SuiNetwork } from './types';

const README = `
# Fungible Tokens (Sui Move Intro Course)

This project shows a managed fungible token with a \`TreasuryCap\` that can mint and burn.

Source: https://github.com/sui-foundation/sui-move-intro-course/tree/main/unit-three/example_projects/fungible_tokens
`.trim();

const moveToml = (pkg: string) =>
  `
[package]
name = "${pkg}"
version = "0.0.1"
edition = "2024.beta"

[dependencies]

[addresses]
${pkg} = "0x0"
`.trimStart();

function files(pkg: string, _network: SuiNetwork): FileMap {
  return {
    'Move.toml': moveToml(pkg),
    'README.md': README,
    'sources/managed.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// Example coin with a trusted manager responsible for minting/burning
/// (e.g., stablecoin)
/// By convention, modules defining custom coin types use upper case names, in
/// contrast to ordinary modules, which use camel case.
module ${pkg}::managed;

// --------------------------------------------------------------------------------------
// ORIGINAL IMPORTS (kept for reference; commented out to avoid duplicate-alias warnings)
// use std::option;
// use sui::coin::{self, Coin, TreasuryCap};
// use sui::transfer;
// use sui::tx_context::{self, TxContext};
// --------------------------------------------------------------------------------------

// We only import types. Function calls use fully-qualified module paths.
use sui::coin::{Coin, TreasuryCap};

/// Name of the coin. By convention, this type has the same name as its parent
/// module and has no fields. The full type of the coin defined by this module will be
/// \`COIN<MANAGED>\`.
public struct MANAGED has drop {}

/// Register the managed currency to acquire its \`TreasuryCap\`.
/// Because this is a module initializer, it ensures the currency only gets registered once.
fun init(witness: MANAGED, ctx: &mut sui::tx_context::TxContext) {
    // Get a treasury cap for the coin and give it to the transaction sender
    let (treasury_cap, metadata) = sui::coin::create_currency<MANAGED>(
        witness,
        2,                         // decimals
        b"MANAGED",                // name
        b"MNG",                    // symbol
        b"",                       // description
        std::option::none(),       // icon url
        ctx,
    );
    sui::transfer::public_freeze_object(metadata);
    sui::transfer::public_transfer(treasury_cap, sui::tx_context::sender(ctx));
}

/// Manager can mint new coins
public fun mint(
    treasury_cap: &mut TreasuryCap<MANAGED>,
    amount: u64,
    recipient: address,
    ctx: &mut sui::tx_context::TxContext,
) {
    treasury_cap.mint_and_transfer(amount, recipient, ctx)
}

/// Manager can burn coins
public fun burn(treasury_cap: &mut TreasuryCap<MANAGED>, coin: Coin<MANAGED>) {
    treasury_cap.burn(coin);
}

#[test_only]
/// Wrapper of module initializer for testing
public fun test_init(ctx: &mut sui::tx_context::TxContext) {
    init(MANAGED {}, ctx)
}
`.trimStart(),
  };
}

export const MoveTemplate_FT: MoveTemplate = {
  id: 'fungible_tokens',
  label: 'Fungible Token (Managed)',
  defaultName: 'fungible_tokens',
  description: 'Managed coin',
  detail: 'Init gives `TreasuryCap`; holder can `mint`/`burn`.',
  files,
};

import { FileMap, MoveTemplate, withCommon } from './types';

const README = withCommon(`
# Coin Examples (Mysten Labs)

This package contains multiple coin examples from Mysten Labs:

- \`my_coin.move\`: Basic custom coin using TreasuryCap
- \`my_coin_new.move\`: Coin created via coin_registry::new_currency_with_otw
- \`fixed_supply.move\`: Coin with fixed supply (mint once, freeze supply)
- \`deflationary_supply.move\`: Coin with burn-only supply
- \`regcoin.move\`: Regulated coin (deny list, legacy API)
- \`regcoin_new.move\`: Regulated coin (deny list, coin_registry API)
- \`non_otw_currency.move\`: Coin created with non-OTW proof of uniqueness

Source: https://github.com/MystenLabs/sui/tree/main/examples/move/coin
`);

const moveToml = (pkg: string) =>
  `
[package]
name = "${pkg}"
version = "0.0.1"
edition = "2024.beta"

[dependencies]

Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "main" }

[addresses]
${pkg} = "0x0"
`.trim();

function files(pkg: string): FileMap {
  return {
    'Move.toml': moveToml(pkg),
    'README.md': README,

    'sources/my_coin.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::my_coin;

use sui::coin::{Self, TreasuryCap};

public struct MY_COIN has drop {}

#[allow(deprecated_usage)]
fun init(witness: MY_COIN, ctx: &mut TxContext) {
    let (treasury, metadata) = coin::create_currency(
        witness,
        6,
        b"MY_COIN",
        b"",
        b"",
        option::none(),
        ctx,
    );
    transfer::public_freeze_object(metadata);
    transfer::public_transfer(treasury, ctx.sender())
}

public fun mint(
    treasury_cap: &mut TreasuryCap<MY_COIN>,
    amount: u64,
    recipient: address,
    ctx: &mut TxContext,
) {
    let coin = coin::mint(treasury_cap, amount, ctx);
    transfer::public_transfer(coin, recipient)
}
`.trim(),

    'sources/my_coin_new.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::my_coin_new;

use sui::coin_registry;

public struct MY_COIN_NEW has drop {}

fun init(witness: MY_COIN_NEW, ctx: &mut TxContext) {
    let (builder, treasury_cap) = coin_registry::new_currency_with_otw(
        witness,
        6,
        b"MY_COIN".to_string(),
        b"My Coin".to_string(),
        b"Standard Unregulated Coin".to_string(),
        b"https://example.com/my_coin.png".to_string(),
        ctx,
    );

    let metadata_cap = builder.finalize(ctx);

    transfer::public_transfer(treasury_cap, ctx.sender());
    transfer::public_transfer(metadata_cap, ctx.sender());
}
`.trim(),

    'sources/fixed_supply.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::fixed_supply;

use sui::coin_registry;

const TOTAL_SUPPLY: u64 = 1000000000_000000;

public struct FIXED_SUPPLY has drop {}

fun init(witness: FIXED_SUPPLY, ctx: &mut TxContext) {
    let (mut currency, mut treasury_cap) = coin_registry::new_currency_with_otw(
        witness,
        6,
        b"FIXED_SUPPLY".to_string(),
        b"Fixed Supply Coin".to_string(),
        b"Cannot be minted nor burned".to_string(),
        b"https://example.com/my_coin.png".to_string(),
        ctx,
    );

    let total_supply = treasury_cap.mint(TOTAL_SUPPLY, ctx);
    currency.make_supply_fixed(treasury_cap);

    let metadata_cap = currency.finalize(ctx);

    transfer::public_transfer(metadata_cap, ctx.sender());
    transfer::public_transfer(total_supply, ctx.sender());
}
`.trim(),

    'sources/deflationary_supply.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::burn_only_supply;

use sui::coin::Coin;
use sui::coin_registry::{Self, Currency};

const TOTAL_SUPPLY: u64 = 1000000000_000000;

public struct BURN_ONLY_SUPPLY has drop {}

fun init(witness: BURN_ONLY_SUPPLY, ctx: &mut TxContext) {
    let (mut currency, mut treasury_cap) = coin_registry::new_currency_with_otw(
        witness,
        6,
        b"BURN_ONLY_SUPPLY".to_string(),
        b"Deflationary Supply Coin".to_string(),
        b"Cannot be minted, but can be burned".to_string(),
        b"https://example.com/my_coin.png".to_string(),
        ctx,
    );

    let total_supply = treasury_cap.mint(TOTAL_SUPPLY, ctx);
    currency.make_supply_burn_only(treasury_cap);

    let metadata_cap = currency.finalize(ctx);

    transfer::public_transfer(metadata_cap, ctx.sender());
    transfer::public_transfer(total_supply, ctx.sender());
}

public fun burn(currency: &mut Currency<BURN_ONLY_SUPPLY>, coin: Coin<BURN_ONLY_SUPPLY>) {
    currency.burn(coin);
}
`.trim(),

    'sources/regcoin.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::regcoin;

use sui::coin::{Self, DenyCapV2};
use sui::deny_list::DenyList;

public struct REGCOIN has drop {}

#[allow(deprecated_usage)]
fun init(witness: REGCOIN, ctx: &mut TxContext) {
    let (treasury, deny_cap, metadata) = coin::create_regulated_currency_v2(
        witness,
        6,
        b"REGCOIN",
        b"",
        b"",
        option::none(),
        false,
        ctx,
    );
    transfer::public_freeze_object(metadata);
    transfer::public_transfer(treasury, ctx.sender());
    transfer::public_transfer(deny_cap, ctx.sender())
}

public fun add_addr_from_deny_list(
    denylist: &mut DenyList,
    denycap: &mut DenyCapV2<REGCOIN>,
    denyaddy: address,
    ctx: &mut TxContext,
) {
    coin::deny_list_v2_add(denylist, denycap, denyaddy, ctx);
}

public fun remove_addr_from_deny_list(
    denylist: &mut DenyList,
    denycap: &mut DenyCapV2<REGCOIN>,
    denyaddy: address,
    ctx: &mut TxContext,
) {
    coin::deny_list_v2_remove(denylist, denycap, denyaddy, ctx);
}
`.trim(),

    'sources/regcoin_new.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::regcoin_new;

use sui::coin::{Self, DenyCapV2};
use sui::coin_registry;
use sui::deny_list::DenyList;

public struct REGCOIN_NEW has drop {}

fun init(witness: REGCOIN_NEW, ctx: &mut TxContext) {
    let (mut currency, treasury_cap) = coin_registry::new_currency_with_otw(
        witness,
        6,
        b"REGCOIN".to_string(),
        b"Regulated Coin".to_string(),
        b"Currency with DenyList Support".to_string(),
        b"https://example.com/regcoin.png".to_string(),
        ctx,
    );

    let deny_cap = currency.make_regulated(true, ctx);
    let metadata_cap = currency.finalize(ctx);
    let sender = ctx.sender();

    transfer::public_transfer(treasury_cap, sender);
    transfer::public_transfer(metadata_cap, sender);
    transfer::public_transfer(deny_cap, sender)
}

public fun add_addr_from_deny_list(
    denylist: &mut DenyList,
    denycap: &mut DenyCapV2<REGCOIN_NEW>,
    denyaddy: address,
    ctx: &mut TxContext,
) {
    coin::deny_list_v2_add(denylist, denycap, denyaddy, ctx);
}

public fun remove_addr_from_deny_list(
    denylist: &mut DenyList,
    denycap: &mut DenyCapV2<REGCOIN_NEW>,
    denyaddy: address,
    ctx: &mut TxContext,
) {
    coin::deny_list_v2_remove(denylist, denycap, denyaddy, ctx);
}
`.trim(),

    'sources/non_otw_currency.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::currency;

use sui::coin::Coin;
use sui::coin_registry::{Self, CoinRegistry};

const TOTAL_SUPPLY: u64 = 1000000000_000000;

public struct MyCoin has key { id: UID }

#[allow(lint(self_transfer))]
public fun new_currency(registry: &mut CoinRegistry, ctx: &mut TxContext): Coin<MyCoin> {
    let (mut currency, mut treasury_cap) = coin_registry::new_currency(
        registry,
        6,
        b"MyCoin".to_string(),
        b"My Coin".to_string(),
        b"Standard Unregulated Coin".to_string(),
        b"https://example.com/my_coin.png".to_string(),
        ctx,
    );

    let total_supply = treasury_cap.mint(TOTAL_SUPPLY, ctx);
    currency.make_supply_burn_only(treasury_cap);

    let metadata_cap = currency.finalize(ctx);
    transfer::public_transfer(metadata_cap, ctx.sender());

    total_supply
}
`.trim(),
  };
}

export const MoveTemplate_Mysten_Coin: MoveTemplate = {
  id: 'mysten_coin',
  label: 'MystenLabs: Coin Examples',
  defaultName: 'coin_examples',
  description: 'Coin patterns',
  detail:
    'MyCoin, FixedSupply, Deflationary, RegCoin, and other coin-based modules.',
  files,
};

import { FileMap, MoveTemplate, withCommon } from './types';

export const README = withCommon(`
# Marketplace (Sui Move Intro Course)

A simple shared marketplace supporting list, buy, delist, and profit withdrawal.

Source: https://github.com/sui-foundation/sui-move-intro-course/tree/main/unit-four/example_projects/marketplace

## Next steps
1. Review \`sources/marketplace.move\`.
2. Run \`sui move build\` to compile.
3. Deploy with \`sui client publish .\` and experiment with listing and buying items.
`);

const MOVE_TOML = (pkg: string) =>
  `
[package]
name = "${pkg}"
version = "0.0.1"
edition = "2024.beta"

[dependencies]

[addresses]
marketplace = "0x0"
sui = "0x2"
`.trimStart();

const MARKETPLACE_MOVE = `
// Copyright (c) Sui Foundation, Inc.
// SPDX-License-Identifier: Apache-2.0

// Modified from https://github.com/MystenLabs/sui/blob/main/sui_programmability/examples/nfts/sources/marketplace.move

module marketplace::marketplace;

// ---------------------- ORIGINAL IMPORTS (kept for reference) ----------------------
// use sui::bag::{Self, Bag};
// use sui::coin::Coin;
// use sui::dynamic_object_field as dof;
// use sui::table::{Self, Table};
// use sui::object;
// use sui::transfer;
// use sui::tx_context::{self, TxContext};
// -----------------------------------------------------------------------------------

// Only keep local names we actually need; call the rest with fully-qualified paths.
use sui::bag::{Self as bag, Bag};
use sui::table::{Self as table, Table};
use sui::coin::Coin;
use sui::dynamic_object_field as dof;

/// For when amount paid does not match the expected.
const EAmountIncorrect: u64 = 0;
/// For when someone tries to delist without ownership.
const ENotOwner: u64 = 1;

/// A shared \`Marketplace\`. Can be created by anyone using the
/// \`create\` function. One instance of \`Marketplace\` accepts
/// only one type of Coin - \`COIN\` for all its listings.
public struct Marketplace<phantom COIN> has key {
    id: UID,
    items: Bag,
    payments: Table<address, Coin<COIN>>,
}

/// A single listing which contains the listed item and its
/// price in [\`Coin<COIN>\`].
public struct Listing has key, store {
    id: UID,
    ask: u64,
    owner: address,
}

/// Create a new shared Marketplace.
public fun create<COIN>(ctx: &mut sui::tx_context::TxContext) {
    let id = sui::object::new(ctx);
    let items = bag::new(ctx);
    let payments = table::new<address, Coin<COIN>>(ctx);
    sui::transfer::share_object(Marketplace<COIN> { id, items, payments })
}

/// List an item at the Marketplace.
public fun list<T: key + store, COIN>(
    marketplace: &mut Marketplace<COIN>,
    item: T,
    ask: u64,
    ctx: &mut sui::tx_context::TxContext,
) {
    let item_id = sui::object::id(&item);
    let mut listing = Listing {
        ask,
        id: sui::object::new(ctx),
        owner: sui::tx_context::sender(ctx),
    };

    dof::add(&mut listing.id, true, item);
    marketplace.items.add(item_id, listing)
}

/// Internal function to remove listing and get an item back. Only owner can do that.
fun delist<T: key + store, COIN>(
    marketplace: &mut Marketplace<COIN>,
    item_id: ID,
    ctx: &sui::tx_context::TxContext,
): T {
    let Listing { mut id, owner, .. } = bag::remove(&mut marketplace.items, item_id);
    assert!(sui::tx_context::sender(ctx) == owner, ENotOwner);
    let item = dof::remove(&mut id, true);
    id.delete();
    item
}

/// Call [\`delist\`] and transfer item to the sender.
public fun delist_and_take<T: key + store, COIN>(
    marketplace: &mut Marketplace<COIN>,
    item_id: ID,
    ctx: &mut sui::tx_context::TxContext,
) {
    let item = delist<T, COIN>(marketplace, item_id, ctx);
    sui::transfer::public_transfer(item, sui::tx_context::sender(ctx));
}

/// Internal function to purchase an item using a known Listing. Payment is in \`Coin<COIN>\`.
/// Amount paid must match the requested amount. If conditions are met,
/// owner of the item gets the payment and buyer receives their item.
fun buy<T: key + store, COIN>(
    marketplace: &mut Marketplace<COIN>,
    item_id: ID,
    paid: Coin<COIN>,
): T {
    let Listing { mut id, ask, owner } = marketplace.items.remove(item_id);
    assert!(ask == paid.value(), EAmountIncorrect);

    if (marketplace.payments.contains(owner)) {
        marketplace.payments.borrow_mut(owner).join(paid)
    } else {
        marketplace.payments.add(owner, paid)
    };

    let item = dof::remove(&mut id, true);
    id.delete();
    item
}

/// Call [\`buy\`] and transfer item to the sender.
public fun buy_and_take<T: key + store, COIN>(
    marketplace: &mut Marketplace<COIN>,
    item_id: ID,
    paid: Coin<COIN>,
    ctx: &mut sui::tx_context::TxContext,
) {
    sui::transfer::public_transfer(
        buy<T, COIN>(marketplace, item_id, paid),
        sui::tx_context::sender(ctx),
    )
}

/// Internal function to take profits from selling items on the \`Marketplace\`.
fun take_profits<COIN>(
    marketplace: &mut Marketplace<COIN>,
    ctx: &sui::tx_context::TxContext,
): Coin<COIN> {
    marketplace.payments.remove(sui::tx_context::sender(ctx))
}

#[lint_allow(self_transfer)]
/// Call \`take_profits\` and transfer Coin object to the sender.
public fun take_profits_and_keep<COIN>(
    marketplace: &mut Marketplace<COIN>,
    ctx: &mut sui::tx_context::TxContext,
) {
    sui::transfer::public_transfer(
        take_profits(marketplace, ctx),
        sui::tx_context::sender(ctx),
    )
}
`.trimStart();

const WIDGET_MOVE = `
// Copyright (c) Sui Foundation, Inc.
// SPDX-License-Identifier: Apache-2.0

// Modified from
// https://github.com/MystenLabs/sui/blob/main/sui_programmability/examples/nfts/sources/marketplace.move
module marketplace::widget;

// ---------------- ORIGINAL (kept for reference) ----------------
// use sui::object;
// use sui::transfer;
// use sui::tx_context::{self, TxContext};
// ---------------------------------------------------------------

public struct Widget has key, store {
    id: UID,
}

#[lint_allow(self_transfer)]
public fun mint(ctx: &mut sui::tx_context::TxContext) {
    let object = Widget { id: sui::object::new(ctx) };
    sui::transfer::public_transfer(object, sui::tx_context::sender(ctx));
}
`.trimStart();

function files(pkg: string): FileMap {
  return {
    'Move.toml': MOVE_TOML(pkg),
    'README.md': README,
    'sources/marketplace.move': MARKETPLACE_MOVE,
    'sources/widget.move': WIDGET_MOVE,
  };
}

export const MoveTemplate_Intro_Marketplace: MoveTemplate = {
  id: 'marketplace',
  label: 'Sui Move Intro Course: Marketplace',
  defaultName: 'marketplace',
  description: 'Shared marketplace',
  detail:
    'Deploy Marketplace<COIN> to list, buy, delist, and withdraw with a sample widget.',
  files,
};

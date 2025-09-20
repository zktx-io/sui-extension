import { FileMap, MoveTemplate, withCommon } from './types';

// ========== READMEs ==========
const ROOT_README = withCommon(
  `
# sui_nft_rental

## Description
NFT renting lets non-owners temporarily use an NFT. This implementation leverages the **Kiosk Extension** to support rental transactions. The approach aligns closely with the ERC-4907 renting standard, making it familiar for Solidity-style use cases brought to Sui.

## Requirements
- Lender can list assets for renting for a specified period.
- Lender defines rental duration; borrower must comply.
- Borrower may receive mutable or immutable access.
  - Immutable: read-only.
  - Mutable: lender should consider downgrade/upgrade ops in the fee.
- After renting finishes, the item can be sold as normal.
- Royalties:
  - Creator royalties are respected via Transfer Policy rules.

Source: https://github.com/MystenLabs/sui/blob/main/examples/move/nft-rental/
`.trim(),
);

const C4_README = `
# How to run and preview the C4 diagrams

1. Navigate a console or terminal to this folder and run \`docker-compose up\`.
2. When the container is up, open http://localhost:8080.
3. Any update on the \`workspace.dsl\` file takes immediate visual effect upon page reload.
4. To stop the container, send a \`Ctrl+C\` signal to the terminal. Or run \`docker-compose down\` in the doc folder if you started the container with the \`-d\` flag.

Link: https://github.com/MystenLabs/sui/blob/main/examples/move/nft-rental/
`.trim();

// ========== Move.toml ==========
const moveToml = (pkg: string) =>
  `
[package]
name = "${pkg}"
version = "0.0.1"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "testnet" }
Kiosk = { git = "https://github.com/MystenLabs/apps.git", subdir = "kiosk", rev = "testnet" }

[addresses]
${pkg} = "0x0"
`.trim();

// ========== Source Code ==========
const NFT_RENTAL_MOVE_CODE = (pkg: string) =>
  `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// This module facilitates the rental of NFTs using kiosks.
///
/// It allows users to list their NFTs for renting, rent NFTs for a specified duration, and return
/// them after the rental period.
module ${pkg}::rentables_ext;

use kiosk::kiosk_lock_rule::Rule as LockRule;
use sui::bag;
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::kiosk::{Kiosk, KioskOwnerCap};
use sui::kiosk_extension;
use sui::package::Publisher;
use sui::sui::SUI;
use sui::transfer_policy::{Self, TransferPolicy, TransferPolicyCap, has_rule};

// === Errors ===
const EExtensionNotInstalled: u64 = 0;
const ENotOwner: u64 = 1;
const ENotEnoughCoins: u64 = 2;
const EInvalidKiosk: u64 = 3;
const ERentingPeriodNotOver: u64 = 4;
const EObjectNotExist: u64 = 5;
const ETotalPriceOverflow: u64 = 6;

// === Constants ===
const PERMISSIONS: u128 = 11;
const SECONDS_IN_A_DAY: u64 = 86400;
const MAX_BASIS_POINTS: u16 = 10_000;
const MAX_VALUE_U64: u64 = 0xff_ff_ff_ff__ff_ff_ff_ff;

// === Structs ===

/// Extension Key for Kiosk Rentables extension.
public struct Rentables has drop {}

/// Struct representing a rented item.
/// Used as a key for the Rentable that's placed in the Extension's Bag.
public struct Rented has copy, drop, store { id: ID }

/// Struct representing a listed item.
/// Used as a key for the Rentable that's placed in the Extension's Bag.
public struct Listed has copy, drop, store { id: ID }

/// Promise struct for borrowing by value.
public struct Promise {
    item: Rented,
    duration: u64,
    start_date: u64,
    price_per_day: u64,
    renter_kiosk: ID,
    borrower_kiosk: ID,
}

/// A wrapper object that holds an asset that is being rented.
/// Contains information relevant to the rental period, cost and renter.
public struct Rentable<T: key + store> has store {
    object: T,
    /// Total amount of time offered for renting in days.
    duration: u64,
    /// Initially undefined, is updated once someone rents it.
    start_date: Option<u64>,
    price_per_day: u64,
    /// The kiosk id that the object was taken from.
    kiosk_id: ID,
}

/// A shared object that should be minted by every creator.
/// Defines the royalties the creator will receive from each rent invocation.
public struct RentalPolicy<phantom T> has key, store {
    id: UID,
    balance: Balance<SUI>,
    /// Basis points (1% = 100, 100% = 10000).
    amount_bp: u64,
}

/// A shared object that should be minted by every creator.
/// Even for creators that do not wish to enforce royalties. Provides authorized access to an
/// empty TransferPolicy.
public struct ProtectedTP<phantom T> has key, store {
    id: UID,
    transfer_policy: TransferPolicy<T>,
    policy_cap: TransferPolicyCap<T>,
}

// === Public Functions ===

/// Enables someone to install the Rentables extension in their Kiosk.
public fun install(kiosk: &mut Kiosk, cap: &KioskOwnerCap, ctx: &mut TxContext) {
    kiosk_extension::add(Rentables {}, kiosk, cap, PERMISSIONS, ctx);
}

/// Remove the extension from the Kiosk. Can only be performed by the owner,
/// The extension storage must be empty for the transaction to succeed.
public fun remove(kiosk: &mut Kiosk, cap: &KioskOwnerCap, _ctx: &mut TxContext) {
    kiosk_extension::remove<Rentables>(kiosk, cap);
}

/// Mints and shares a ProtectedTP & a RentalPolicy object for type T.
/// Can only be performed by the publisher of type T.
public fun setup_renting<T>(publisher: &Publisher, amount_bp: u64, ctx: &mut TxContext) {
    // Creates an empty TP and shares a ProtectedTP<T> object.
    let (transfer_policy, policy_cap) = transfer_policy::new<T>(publisher, ctx);

    let protected_tp = ProtectedTP {
        id: object::new(ctx),
        transfer_policy,
        policy_cap,
    };

    let rental_policy = RentalPolicy<T> {
        id: object::new(ctx),
        balance: balance::zero<SUI>(),
        amount_bp,
    };

    transfer::share_object(protected_tp);
    transfer::share_object(rental_policy);
}

/// Enables someone to list an asset within the Rentables extension's Bag.
/// Requires the existence of a ProtectedTP which can only be created by the creator of type T.
/// Assumes item is already placed (& optionally locked) in a Kiosk.
public fun list<T: key + store>(
    kiosk: &mut Kiosk,
    cap: &KioskOwnerCap,
    protected_tp: &ProtectedTP<T>,
    item_id: ID,
    duration: u64,
    price_per_day: u64,
    ctx: &mut TxContext,
) {
    assert!(kiosk_extension::is_installed<Rentables>(kiosk), EExtensionNotInstalled);

    kiosk.set_owner(cap, ctx);
    kiosk.list<T>(cap, item_id, 0);

    let coin = coin::zero<SUI>(ctx);
    let (object, request) = kiosk.purchase<T>(item_id, coin);

    let (_item, _paid, _from) = protected_tp.transfer_policy.confirm_request(request);

    let rentable = Rentable {
        object,
        duration,
        start_date: option::none<u64>(),
        price_per_day,
        kiosk_id: object::id(kiosk),
    };

    place_in_bag<T, Listed>(kiosk, Listed { id: item_id }, rentable);
}

/// Delist an item that is not currently rented.
/// Places (or locks, if a lock rule is present) the object back to owner's Kiosk.
public fun delist<T: key + store>(
    kiosk: &mut Kiosk,
    cap: &KioskOwnerCap,
    transfer_policy: &TransferPolicy<T>,
    item_id: ID,
    _ctx: &mut TxContext,
) {
    assert!(kiosk.has_access(cap), ENotOwner);

    let rentable = take_from_bag<T, Listed>(kiosk, Listed { id: item_id });

    let Rentable {
        object,
        duration: _,
        start_date: _,
        price_per_day: _,
        kiosk_id: _,
    } = rentable;

    if (has_rule<T, LockRule>(transfer_policy)) {
        kiosk.lock(cap, transfer_policy, object);
    } else {
        kiosk.place(cap, object);
    };
}

/// Rent a listed item, transferring fees and recording rental start.
public fun rent<T: key + store>(
    renter_kiosk: &mut Kiosk,
    borrower_kiosk: &mut Kiosk,
    rental_policy: &mut RentalPolicy<T>,
    item_id: ID,
    mut coin: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(kiosk_extension::is_installed<Rentables>(borrower_kiosk), EExtensionNotInstalled);

    let mut rentable = take_from_bag<T, Listed>(renter_kiosk, Listed { id: item_id });

    let max_price_per_day = MAX_VALUE_U64 / rentable.duration;
    assert!(rentable.price_per_day <= max_price_per_day, ETotalPriceOverflow);
    let total_price = rentable.price_per_day * rentable.duration;

    let coin_value = coin.value();
    assert!(coin_value == total_price, ENotEnoughCoins);

    // fees = total_price * amount_bp / 10000
    let mut fees_amount = coin_value as u128;
    fees_amount = fees_amount * (rental_policy.amount_bp as u128);
    fees_amount = fees_amount / (MAX_BASIS_POINTS as u128);

    let fees = coin.split(fees_amount as u64, ctx);

    coin::put(&mut rental_policy.balance, fees);
    transfer::public_transfer(coin, renter_kiosk.owner());
    rentable.start_date.fill(clock.timestamp_ms());

    place_in_bag<T, Rented>(borrower_kiosk, Rented { id: item_id }, rentable);
}

/// Borrow by reference from borrower's bag.
public fun borrow<T: key + store>(
    kiosk: &mut Kiosk,
    cap: &KioskOwnerCap,
    item_id: ID,
    _ctx: &mut TxContext,
): &T {
    assert!(kiosk.has_access(cap), ENotOwner);
    let ext_storage_mut = kiosk_extension::storage_mut(Rentables {}, kiosk);
    let rentable: &Rentable<T> = &ext_storage_mut[Rented { id: item_id }];
    &rentable.object
}

/// Borrow by value with a Promise; later reconstruct and return it.
public fun borrow_val<T: key + store>(
    kiosk: &mut Kiosk,
    cap: &KioskOwnerCap,
    item_id: ID,
    _ctx: &mut TxContext,
): (T, Promise) {
    assert!(kiosk.has_access(cap), ENotOwner);
    let borrower_kiosk = object::id(kiosk);

    let rentable = take_from_bag<T, Rented>(kiosk, Rented { id: item_id });

    let promise = Promise {
        item: Rented { id: item_id },
        duration: rentable.duration,
        start_date: *option::borrow(&rentable.start_date),
        price_per_day: rentable.price_per_day,
        renter_kiosk: rentable.kiosk_id,
        borrower_kiosk,
    };

    let Rentable {
        object,
        duration: _,
        start_date: _,
        price_per_day: _,
        kiosk_id: _,
    } = rentable;

    (object, promise)
}

/// Return the borrowed item using the Promise.
public fun return_val<T: key + store>(
    kiosk: &mut Kiosk,
    object: T,
    promise: Promise,
    _ctx: &mut TxContext,
) {
    assert!(kiosk_extension::is_installed<Rentables>(kiosk), EExtensionNotInstalled);

    let Promise {
        item,
        duration,
        start_date,
        price_per_day,
        renter_kiosk,
        borrower_kiosk,
    } = promise;

    let kiosk_id = object::id(kiosk);
    assert!(kiosk_id == borrower_kiosk, EInvalidKiosk);

    let rentable = Rentable {
        object,
        duration,
        start_date: option::some(start_date),
        price_per_day,
        kiosk_id: renter_kiosk,
    };

    place_in_bag(kiosk, item, rentable);
}

/// Owner reclaims the asset once the rental period has concluded.
public fun reclaim<T: key + store>(
    renter_kiosk: &mut Kiosk,
    borrower_kiosk: &mut Kiosk,
    transfer_policy: &TransferPolicy<T>,
    clock: &Clock,
    item_id: ID,
    _ctx: &mut TxContext,
) {
    assert!(kiosk_extension::is_installed<Rentables>(renter_kiosk), EExtensionNotInstalled);

    let rentable = take_from_bag<T, Rented>(borrower_kiosk, Rented { id: item_id });

    let Rentable {
        object,
        duration,
        start_date,
        price_per_day: _,
        kiosk_id,
    } = rentable;

    assert!(object::id(renter_kiosk) == kiosk_id, EInvalidKiosk);

    let start_date_ms = *option::borrow(&start_date);
    let current_timestamp = clock.timestamp_ms();
    let final_timestamp = start_date_ms + duration * SECONDS_IN_A_DAY;
    assert!(current_timestamp > final_timestamp, ERentingPeriodNotOver);

    if (transfer_policy.has_rule<T, LockRule>()) {
        kiosk_extension::lock<Rentables, T>(
            Rentables {},
            renter_kiosk,
            object,
            transfer_policy,
        );
    } else {
        kiosk_extension::place<Rentables, T>(
            Rentables {},
            renter_kiosk,
            object,
            transfer_policy,
        );
    };
}

// === Private Functions ===

fun take_from_bag<T: key + store, Key: store + copy + drop>(
    kiosk: &mut Kiosk,
    item: Key,
): Rentable<T> {
    let ext_storage_mut = kiosk_extension::storage_mut(Rentables {}, kiosk);
    assert!(bag::contains(ext_storage_mut, item), EObjectNotExist);
    bag::remove<Key, Rentable<T>>(
        ext_storage_mut,
        item,
    )
}

fun place_in_bag<T: key + store, Key: store + copy + drop>(
    kiosk: &mut Kiosk,
    item: Key,
    rentable: Rentable<T>,
) {
    let ext_storage_mut = kiosk_extension::storage_mut(Rentables {}, kiosk);
    bag::add(ext_storage_mut, item, rentable);
}

// === Test Helpers (public for tests) ===

#[test_only]
public fun create_listed(id: ID): Listed {
    Listed { id }
}
`.trim();

const NFT_RENTAL_TESTS_CODE = (pkg: string) =>
  `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
#[test_only]
module ${pkg}::tests;

use kiosk::kiosk_lock_rule as lock_rule;
use ${pkg}::rentables_ext::{Self, Promise, ProtectedTP, RentalPolicy, Listed};
use sui::clock::{Self, Clock};
use sui::kiosk::{Kiosk, KioskOwnerCap};
use sui::kiosk_test_utils;
use sui::package::{Self, Publisher};
use sui::test_scenario::{Self as ts, Scenario};
use sui::transfer_policy::{Self, TransferPolicy, TransferPolicyCap};

const CREATOR: address = @0xCCCC;
const RENTER: address = @0xAAAA;
const BORROWER: address = @0xBBBB;
const THIEF: address = @0xDDDD;

public struct T has key, store { id: UID }
public struct WITNESS has drop {}

// ==================== Tests ====================
#[test]
fun test_install_extension() {
    let mut ts = ts::begin(RENTER);
    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());

    ts.install_ext(RENTER, renter_kiosk_id);
    ts.end();
}

#[test]
fun test_remove_extension() {
    let mut ts = ts::begin(RENTER);

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());

    ts.install_ext(RENTER, renter_kiosk_id);
    ts.remove_ext(RENTER, renter_kiosk_id);
    ts.end();
}

#[test]
fun test_setup_renting() {
    let mut ts = ts::begin(RENTER);

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    ts.setup(RENTER, &publisher, 50);

    {
        ts.next_tx(RENTER);
        let protected_tp: ProtectedTP<T> = ts.take_shared();
        ts::return_shared(protected_tp);
    };

    publisher.burn_publisher();
    ts.end();
}

#[test]
fun test_list_with_extension() {
    let mut ts = ts::begin(RENTER);
    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());

    ts.setup(RENTER, &publisher, 50);
    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);

    publisher.burn_publisher();
    ts.end();
}

#[test]
#[expected_failure(abort_code = rentables_ext::EExtensionNotInstalled)]
fun test_list_without_extension() {
    let mut ts = ts::begin(RENTER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());

    ts.setup(RENTER, &publisher, 50);
    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);
    abort 0xbad
}

#[test]
#[expected_failure(abort_code = 0x2::kiosk::ENotOwner)]
fun test_list_with_wrong_cap() {
    let mut ts = ts::begin(RENTER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());
    let _borrower_kiosk_id = create_kiosk(BORROWER, ts.ctx());

    ts.setup(RENTER, &publisher, 50);
    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);

    ts.next_tx(RENTER);
    let mut kiosk: Kiosk = ts.take_shared_by_id(renter_kiosk_id);
    let kiosk_cap: KioskOwnerCap = ts.take_from_address(BORROWER);
    let protected_tp: ProtectedTP<T> = ts.take_shared();

    rentables_ext::list(&mut kiosk, &kiosk_cap, &protected_tp, item_id, 10, 10, ts.ctx());
    abort 0xbad
}

#[test]
fun test_delist_locked() {
    let mut ts = ts::begin(RENTER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let witness = WITNESS {};

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());

    let publisher = package::test_claim(witness, ts.ctx());
    create_transfer_policy(CREATOR, &publisher, ts.ctx());

    ts.add_lock_rule(CREATOR);
    ts.setup(RENTER, &publisher, 50);
    ts.lock_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);
    ts.delist_from_rent(RENTER, renter_kiosk_id, item_id);

    publisher.burn_publisher();
    ts.end();
}

#[test]
fun test_delist_placed() {
    let mut ts = ts::begin(RENTER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());

    create_transfer_policy(CREATOR, &publisher, ts.ctx());
    ts.setup(RENTER, &publisher, 50);
    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);
    ts.delist_from_rent(RENTER, renter_kiosk_id, item_id);

    publisher.burn_publisher();
    ts.end();
}

#[test]
#[expected_failure(abort_code = rentables_ext::EObjectNotExist)]
fun test_delist_rented() {
    let mut ts = ts::begin(RENTER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let clock = clock::create_for_testing(ts.ctx());

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());
    let borrower_kiosk_id = create_kiosk(BORROWER, ts.ctx());

    create_transfer_policy(CREATOR, &publisher, ts.ctx());
    ts.setup(RENTER, &publisher, 50);
    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);
    ts.install_ext(BORROWER, borrower_kiosk_id);
    ts.rent(BORROWER, renter_kiosk_id, borrower_kiosk_id, item_id, 100, &clock);
    ts.delist_from_rent(BORROWER, borrower_kiosk_id, item_id);
    abort 0xbad
}

#[test]
#[expected_failure(abort_code = rentables_ext::ENotOwner)]
fun test_delist_with_wrong_cap() {
    let mut ts = ts::begin(RENTER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());
    let _borrower_kiosk_id = create_kiosk(BORROWER, ts.ctx());

    create_transfer_policy(CREATOR, &publisher, ts.ctx());
    ts.setup(RENTER, &publisher, 50);
    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);

    ts.next_tx(RENTER);
    let mut kiosk: Kiosk = ts.take_shared_by_id(renter_kiosk_id);
    let kiosk_cap: KioskOwnerCap = ts.take_from_address(BORROWER);
    let transfer_policy: TransferPolicy<T> = ts.take_shared();

    rentables_ext::delist<T>(&mut kiosk, &kiosk_cap, &transfer_policy, item_id, ts.ctx());
    abort 0xbad
}

#[test]
fun test_rent_with_extension() {
    let mut ts = ts::begin(BORROWER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let clock = clock::create_for_testing(ts.ctx());

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());
    let borrower_kiosk_id = create_kiosk(BORROWER, ts.ctx());

    ts.setup(RENTER, &publisher, 50);
    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);
    ts.install_ext(BORROWER, borrower_kiosk_id);
    ts.rent(BORROWER, renter_kiosk_id, borrower_kiosk_id, item_id, 100, &clock);

    clock.destroy_for_testing();
    publisher.burn_publisher();
    ts.end();
}

#[test]
#[expected_failure(abort_code = rentables_ext::EExtensionNotInstalled)]
fun test_rent_without_extension() {
    let mut ts = ts::begin(BORROWER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let clock = clock::create_for_testing(ts.ctx());

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());
    let borrower_kiosk_id = create_kiosk(BORROWER, ts.ctx());

    ts.setup(RENTER, &publisher, 50);
    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);
    ts.rent(BORROWER, renter_kiosk_id, borrower_kiosk_id, item_id, 100, &clock);
    abort 0xbad
}

#[test]
#[expected_failure(abort_code = rentables_ext::ENotEnoughCoins)]
fun test_rent_with_not_enough_coins() {
    let mut ts = ts::begin(BORROWER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let clock = clock::create_for_testing(ts.ctx());

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());
    let borrower_kiosk_id = create_kiosk(BORROWER, ts.ctx());

    ts.setup(RENTER, &publisher, 50);
    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);
    ts.install_ext(BORROWER, borrower_kiosk_id);
    ts.rent(BORROWER, renter_kiosk_id, borrower_kiosk_id, item_id, 10, &clock);
    abort 0xbad
}

#[test]
#[expected_failure(abort_code = rentables_ext::ETotalPriceOverflow)]
fun test_rent_with_overflow() {
    let mut ts = ts::begin(BORROWER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let clock = clock::create_for_testing(ts.ctx());

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());
    let borrower_kiosk_id = create_kiosk(BORROWER, ts.ctx());

    ts.setup(RENTER, &publisher, 50);
    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 100, 1844674407370955160);
    ts.install_ext(BORROWER, borrower_kiosk_id);
    ts.rent(BORROWER, renter_kiosk_id, borrower_kiosk_id, item_id, 100, &clock);
    abort 0xbad
}

#[test]
fun test_borrow() {
    let mut ts = ts::begin(BORROWER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let clock = clock::create_for_testing(ts.ctx());

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());
    let borrower_kiosk_id = create_kiosk(BORROWER, ts.ctx());

    ts.setup(RENTER, &publisher, 50);

    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);
    ts.install_ext(BORROWER, borrower_kiosk_id);
    ts.rent(BORROWER, renter_kiosk_id, borrower_kiosk_id, item_id, 100, &clock);
    ts.borrow(BORROWER, borrower_kiosk_id, item_id);

    clock.destroy_for_testing();
    publisher.burn_publisher();
    ts.end();
}

#[test]
#[expected_failure(abort_code = rentables_ext::ENotOwner)]
fun test_borrow_with_wrong_cap() {
    let mut ts = ts::begin(BORROWER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let clock = clock::create_for_testing(ts.ctx());

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());
    let borrower_kiosk_id = create_kiosk(BORROWER, ts.ctx());

    ts.setup(RENTER, &publisher, 50);
    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);
    ts.install_ext(BORROWER, borrower_kiosk_id);
    ts.rent(BORROWER, renter_kiosk_id, borrower_kiosk_id, item_id, 100, &clock);

    ts.next_tx(BORROWER);
    let mut kiosk: Kiosk = ts.take_shared_by_id(borrower_kiosk_id);
    let kiosk_cap: KioskOwnerCap = ts.take_from_address(RENTER);

    let _object = rentables_ext::borrow<T>(&mut kiosk, &kiosk_cap, item_id, ts.ctx());
    abort 0xbad
}

#[test]
fun test_borrow_val() {
    let mut ts = ts::begin(BORROWER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let clock = clock::create_for_testing(ts.ctx());

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());
    let borrower_kiosk_id = create_kiosk(BORROWER, ts.ctx());

    ts.setup(RENTER, &publisher, 50);
    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);
    ts.install_ext(BORROWER, borrower_kiosk_id);
    ts.rent(BORROWER, renter_kiosk_id, borrower_kiosk_id, item_id, 100, &clock);

    let promise = ts.borrow_val(BORROWER, borrower_kiosk_id, item_id);
    ts.return_val(promise, BORROWER, borrower_kiosk_id);

    clock.destroy_for_testing();
    publisher.burn_publisher();
    ts.end();
}

#[test]
#[expected_failure(abort_code = rentables_ext::ENotOwner)]
fun test_borrow_val_with_wrong_cap() {
    let mut ts = ts::begin(BORROWER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let clock = clock::create_for_testing(ts.ctx());

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());
    let borrower_kiosk_id = create_kiosk(BORROWER, ts.ctx());

    ts.setup(RENTER, &publisher, 50);
    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);
    ts.install_ext(BORROWER, borrower_kiosk_id);
    ts.rent(BORROWER, renter_kiosk_id, borrower_kiosk_id, item_id, 100, &clock);

    ts.next_tx(BORROWER);
    let mut kiosk: Kiosk = ts.take_shared_by_id(borrower_kiosk_id);
    let kiosk_cap: KioskOwnerCap = ts.take_from_address(RENTER);

    let (_object, _promise) = rentables_ext::borrow_val<T>(
        &mut kiosk,
        &kiosk_cap,
        item_id,
        ts.ctx(),
    );

    abort 0xbad
}

#[test]
fun test_return_val() {
    let mut ts = ts::begin(BORROWER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let clock = clock::create_for_testing(ts.ctx());

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());
    let borrower_kiosk_id = create_kiosk(BORROWER, ts.ctx());

    ts.setup(RENTER, &publisher, 50);
    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);
    ts.install_ext(BORROWER, borrower_kiosk_id);
    ts.rent(BORROWER, renter_kiosk_id, borrower_kiosk_id, item_id, 100, &clock);

    let promise = ts.borrow_val(BORROWER, borrower_kiosk_id, item_id);

    ts.return_val(promise, BORROWER, borrower_kiosk_id);

    clock.destroy_for_testing();
    publisher.burn_publisher();
    ts.end();
}

#[test]
#[expected_failure(abort_code = rentables_ext::EExtensionNotInstalled)]
fun test_return_val_without_extension() {
    let mut ts = ts::begin(BORROWER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let clock = clock::create_for_testing(ts.ctx());

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());
    let borrower_kiosk_id = create_kiosk(BORROWER, ts.ctx());

    ts.setup(RENTER, &publisher, 50);
    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);
    ts.install_ext(BORROWER, borrower_kiosk_id);
    ts.rent(BORROWER, renter_kiosk_id, borrower_kiosk_id, item_id, 100, &clock);

    let promise = ts.borrow_val(BORROWER, borrower_kiosk_id, item_id);
    ts.remove_ext(BORROWER, borrower_kiosk_id);
    ts.return_val(promise, BORROWER, borrower_kiosk_id);
    abort 0xbad
}

#[test]
#[expected_failure(abort_code = rentables_ext::EInvalidKiosk)]
fun test_return_val_wrong_kiosk() {
    let mut ts = ts::begin(BORROWER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let clock = clock::create_for_testing(ts.ctx());

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());
    let borrower_kiosk_id = create_kiosk(BORROWER, ts.ctx());

    ts.setup(RENTER, &publisher, 50);
    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);
    ts.install_ext(BORROWER, borrower_kiosk_id);
    ts.rent(BORROWER, renter_kiosk_id, borrower_kiosk_id, item_id, 100, &clock);

    let promise = ts.borrow_val(BORROWER, borrower_kiosk_id, item_id);
    ts.return_val(promise, BORROWER, renter_kiosk_id);
    abort 0xbad
}

#[test]
fun test_reclaim() {
    let mut ts = ts::begin(BORROWER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let mut clock = clock::create_for_testing(ts.ctx());

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());
    let borrower_kiosk_id = create_kiosk(BORROWER, ts.ctx());

    create_transfer_policy(CREATOR, &publisher, ts.ctx());
    ts.setup(RENTER, &publisher, 50);
    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);
    ts.install_ext(BORROWER, borrower_kiosk_id);
    ts.rent(BORROWER, renter_kiosk_id, borrower_kiosk_id, item_id, 100, &clock);
    ts.reclaim(RENTER, renter_kiosk_id, borrower_kiosk_id, item_id, 432000000, &mut clock);

    clock.destroy_for_testing();
    publisher.burn_publisher();
    ts.end();
}

#[test]
fun test_reclaim_locked() {
    let mut ts = ts::begin(RENTER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let mut clock = clock::create_for_testing(ts.ctx());

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());
    let borrower_kiosk_id = create_kiosk(BORROWER, ts.ctx());

    create_transfer_policy(CREATOR, &publisher, ts.ctx());
    ts.add_lock_rule(CREATOR);
    ts.setup(RENTER, &publisher, 50);
    ts.lock_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);
    ts.install_ext(BORROWER, borrower_kiosk_id);
    ts.rent(BORROWER, renter_kiosk_id, borrower_kiosk_id, item_id, 100, &clock);
    ts.reclaim(RENTER, renter_kiosk_id, borrower_kiosk_id, item_id, 432000000, &mut clock);

    clock.destroy_for_testing();
    publisher.burn_publisher();
    ts.end();
}

#[test]
#[expected_failure(abort_code = rentables_ext::EInvalidKiosk)]
fun test_reclaim_wrong_kiosk() {
    let mut ts = ts::begin(BORROWER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let mut clock = clock::create_for_testing(ts.ctx());

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());
    let borrower_kiosk_id = create_kiosk(BORROWER, ts.ctx());
    let thief_kiosk_id = create_kiosk(THIEF, ts.ctx());

    create_transfer_policy(CREATOR, &publisher, ts.ctx());
    ts.setup(RENTER, &publisher, 50);
    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);
    ts.install_ext(BORROWER, borrower_kiosk_id);
    ts.rent(BORROWER, renter_kiosk_id, borrower_kiosk_id, item_id, 100, &clock);
    ts.install_ext(THIEF, thief_kiosk_id);
    ts.reclaim(RENTER, thief_kiosk_id, borrower_kiosk_id, item_id, 432000000, &mut clock);
    abort 0xbad
}

#[test]
#[expected_failure(abort_code = rentables_ext::ERentingPeriodNotOver)]
fun test_reclaim_renting_period_not_over() {
    let mut ts = ts::begin(BORROWER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let mut clock = clock::create_for_testing(ts.ctx());

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());
    let borrower_kiosk_id = create_kiosk(BORROWER, ts.ctx());

    create_transfer_policy(CREATOR, &publisher, ts.ctx());
    ts.setup(RENTER, &publisher, 50);
    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);
    ts.install_ext(BORROWER, borrower_kiosk_id);
    ts.rent(BORROWER, renter_kiosk_id, borrower_kiosk_id, item_id, 100, &clock);
    ts.reclaim(RENTER, renter_kiosk_id, borrower_kiosk_id, item_id, 20000, &mut clock);
    abort 0xbad
}

#[test]
#[expected_failure(abort_code = rentables_ext::EExtensionNotInstalled)]
fun test_reclaim_without_extension() {
    let mut ts = ts::begin(BORROWER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);

    let mut clock = clock::create_for_testing(ts.ctx());

    let witness = WITNESS {};
    let publisher = package::test_claim(witness, ts.ctx());

    let renter_kiosk_id = create_kiosk(RENTER, ts.ctx());
    let borrower_kiosk_id = create_kiosk(BORROWER, ts.ctx());

    create_transfer_policy(CREATOR, &publisher, ts.ctx());
    ts.setup(RENTER, &publisher, 50);
    ts.place_in_kiosk(RENTER, renter_kiosk_id, item);
    ts.install_ext(RENTER, renter_kiosk_id);
    ts.list_for_rent(RENTER, renter_kiosk_id, item_id, 10, 10);
    ts.install_ext(BORROWER, borrower_kiosk_id);
    ts.rent(BORROWER, renter_kiosk_id, borrower_kiosk_id, item_id, 100, &clock);
    ts.remove_ext(RENTER, renter_kiosk_id);
    ts.reclaim(RENTER, renter_kiosk_id, borrower_kiosk_id, item_id, 432000000, &mut clock);
    abort 0xbad
}

#[test]
#[expected_failure(abort_code = rentables_ext::EObjectNotExist)]
fun test_take_non_existed_item() {
    let mut ts = ts::begin(RENTER);

    let item = T { id: object::new(ts.ctx()) };
    let item_id = object::id(&item);
    transfer::public_transfer(item, RENTER);

    let kiosk_id = create_kiosk(RENTER, ts.ctx());

    ts.install_ext(RENTER, kiosk_id);

    ts.next_tx(RENTER);
    let mut kiosk: Kiosk = ts.take_shared_by_id(kiosk_id);
    let listed = rentables_ext::create_listed(item_id);
    rentables_ext::test_take_from_bag<T, Listed>(&mut kiosk, listed);
    abort 0xbad
}

// ==================== Helper methods ====================

fun create_kiosk(sender: address, ctx: &mut TxContext): ID {
    let (kiosk, kiosk_cap) = kiosk_test_utils::get_kiosk(ctx);
    let kiosk_id = object::id(&kiosk);
    transfer::public_share_object(kiosk);
    transfer::public_transfer(kiosk_cap, sender);
    kiosk_id
}

fun create_transfer_policy(sender: address, publisher: &Publisher, ctx: &mut TxContext) {
    let (transfer_policy, policy_cap) = transfer_policy::new<T>(publisher, ctx);
    transfer::public_share_object(transfer_policy);
    transfer::public_transfer(policy_cap, sender);
}

use fun install_ext as Scenario.install_ext;
fun install_ext(ts: &mut Scenario, sender: address, kiosk_id: ID) {
    ts.next_tx(sender);
    let mut kiosk: Kiosk = ts.take_shared_by_id(kiosk_id);
    let kiosk_cap = ts.take_from_sender();

    rentables_ext::install(&mut kiosk, &kiosk_cap, ts.ctx());

    ts::return_shared(kiosk);
    ts.return_to_sender(kiosk_cap);
}

use fun remove_ext as Scenario.remove_ext;
fun remove_ext(ts: &mut Scenario, sender: address, kiosk_id: ID) {
    ts.next_tx(sender);
    let mut kiosk: Kiosk = ts.take_shared_by_id(kiosk_id);
    let kiosk_cap: KioskOwnerCap = ts.take_from_sender();

    rentables_ext::remove(&mut kiosk, &kiosk_cap, ts.ctx());

    ts::return_shared(kiosk);
    ts.return_to_sender(kiosk_cap);
}

use fun setup as Scenario.setup;
fun setup(ts: &mut Scenario, sender: address, publisher: &Publisher, amount_bp: u64) {
    ts.next_tx(sender);
    rentables_ext::setup_renting<T>(publisher, amount_bp, ts.ctx());
}

use fun lock_in_kiosk as Scenario.lock_in_kiosk;
fun lock_in_kiosk(ts: &mut Scenario, sender: address, kiosk_id: ID, item: T) {
    ts.next_tx(sender);

    let mut kiosk: Kiosk = ts.take_shared_by_id(kiosk_id);
    let kiosk_cap: KioskOwnerCap = ts.take_from_sender();
    let transfer_policy: TransferPolicy<T> = ts.take_shared();

    kiosk.lock(&kiosk_cap, &transfer_policy, item);

    ts::return_shared(kiosk);
    ts.return_to_sender(kiosk_cap);
    ts::return_shared(transfer_policy);
}

use fun place_in_kiosk as Scenario.place_in_kiosk;
fun place_in_kiosk(ts: &mut Scenario, sender: address, kiosk_id: ID, item: T) {
    ts.next_tx(sender);
    let mut kiosk: Kiosk = ts.take_shared_by_id(kiosk_id);
    let kiosk_cap: KioskOwnerCap = ts.take_from_sender();

    kiosk.place(&kiosk_cap, item);

    ts::return_shared(kiosk);
    ts.return_to_sender(kiosk_cap);
}

use fun list_for_rent as Scenario.list_for_rent;
fun list_for_rent(
    ts: &mut Scenario,
    sender: address,
    kiosk_id: ID,
    item_id: ID,
    duration: u64,
    price: u64,
) {
    ts.next_tx(sender);
    let mut kiosk: Kiosk = ts.take_shared_by_id(kiosk_id);
    let kiosk_cap: KioskOwnerCap = ts.take_from_sender();
    let protected_tp: ProtectedTP<T> = ts.take_shared();

    rentables_ext::list(
        &mut kiosk,
        &kiosk_cap,
        &protected_tp,
        item_id,
        duration,
        price,
        ts.ctx(),
    );

    ts::return_shared(kiosk);
    ts.return_to_sender(kiosk_cap);
    ts::return_shared(protected_tp);
}

use fun delist_from_rent as Scenario.delist_from_rent;
fun delist_from_rent(ts: &mut Scenario, sender: address, kiosk_id: ID, item_id: ID) {
    ts.next_tx(sender);
    let mut kiosk: Kiosk = ts.take_shared_by_id(kiosk_id);
    let kiosk_cap: KioskOwnerCap = ts.take_from_sender();
    let transfer_policy: TransferPolicy<T> = ts.take_shared();

    rentables_ext::delist<T>(&mut kiosk, &kiosk_cap, &transfer_policy, item_id, ts.ctx());

    ts::return_shared(kiosk);
    ts.return_to_sender(kiosk_cap);
    ts::return_shared(transfer_policy);
}

use fun rent as Scenario.rent;
fun rent(
    ts: &mut Scenario,
    sender: address,
    renter_kiosk_id: ID,
    borrower_kiosk_id: ID,
    item_id: ID,
    coin_amount: u64,
    clock: &Clock,
) {
    ts.next_tx(sender);

    let mut borrower_kiosk: Kiosk = ts.take_shared_by_id(borrower_kiosk_id);
    let mut renter_kiosk: Kiosk = ts.take_shared_by_id(renter_kiosk_id);
    let mut rental_policy: RentalPolicy<T> = ts.take_shared();

    let coin = kiosk_test_utils::get_sui(coin_amount, ts.ctx());

    rentables_ext::rent<T>(
        &mut renter_kiosk,
        &mut borrower_kiosk,
        &mut rental_policy,
        item_id,
        coin,
        clock,
        ts.ctx(),
    );

    ts::return_shared(borrower_kiosk);
    ts::return_shared(renter_kiosk);
    ts::return_shared(rental_policy);
}

use fun borrow as Scenario.borrow;
fun borrow(ts: &mut Scenario, sender: address, kiosk_id: ID, item_id: ID) {
    ts.next_tx(sender);
    let mut kiosk: Kiosk = ts.take_shared_by_id(kiosk_id);
    let kiosk_cap: KioskOwnerCap = ts.take_from_sender();

    let _object = rentables_ext::borrow<T>(&mut kiosk, &kiosk_cap, item_id, ts.ctx());

    ts::return_shared(kiosk);
    ts.return_to_sender(kiosk_cap);
}

use fun borrow_val as Scenario.borrow_val;
fun borrow_val(ts: &mut Scenario, sender: address, kiosk_id: ID, item_id: ID): Promise {
    ts.next_tx(sender);
    let mut kiosk: Kiosk = ts.take_shared_by_id(kiosk_id);
    let kiosk_cap: KioskOwnerCap = ts.take_from_sender();

    let (object, promise) = rentables_ext::borrow_val<T>(
        &mut kiosk,
        &kiosk_cap,
        item_id,
        ts.ctx(),
    );

    transfer::public_transfer(object, sender);
    ts::return_shared(kiosk);
    ts.return_to_sender(kiosk_cap);
    promise
}

use fun return_val as Scenario.return_val;
fun return_val(ts: &mut Scenario, promise: Promise, sender: address, kiosk_id: ID) {
    ts.next_tx(sender);
    let mut kiosk: Kiosk = ts.take_shared_by_id(kiosk_id);
    let object: T = ts.take_from_sender();

    rentables_ext::return_val(&mut kiosk, object, promise, ts.ctx());
    ts::return_shared(kiosk);
}

use fun reclaim as Scenario.reclaim;
fun reclaim(
    ts: &mut Scenario,
    sender: address,
    renter_kiosk_id: ID,
    borrower_kiosk_id: ID,
    item_id: ID,
    tick: u64,
    clock: &mut Clock,
) {
    ts.next_tx(sender);
    let mut borrower_kiosk: Kiosk = ts.take_shared_by_id(borrower_kiosk_id);
    let mut renter_kiosk: Kiosk = ts.take_shared_by_id(renter_kiosk_id);
    let policy: TransferPolicy<T> = ts.take_shared();

    clock.increment_for_testing(tick);
    rentables_ext::reclaim(
        &mut renter_kiosk,
        &mut borrower_kiosk,
        &policy,
        clock,
        item_id,
        ts.ctx(),
    );

    ts::return_shared(policy);
    ts::return_shared(borrower_kiosk);
    ts::return_shared(renter_kiosk);
}

use fun add_lock_rule as Scenario.add_lock_rule;
fun add_lock_rule(ts: &mut Scenario, sender: address) {
    ts.next_tx(sender);
    let mut transfer_policy: TransferPolicy<T> = ts.take_shared();
    let policy_cap: TransferPolicyCap<T> = ts.take_from_sender();

    lock_rule::add(&mut transfer_policy, &policy_cap);

    ts::return_shared(transfer_policy);
    ts.return_to_sender(policy_cap);
}
`.trim();

// ========== FileMap ==========
function files(pkg: string): FileMap {
  return {
    'Move.toml': moveToml(pkg),
    'README.md': ROOT_README,
    'c4-architecture/README.md': C4_README,
    'sources/nft_rental.move': NFT_RENTAL_MOVE_CODE(pkg),
    'tests/tests.move': NFT_RENTAL_TESTS_CODE(pkg),
  };
}

// ========== Template ==========
export const MoveTemplate_Mysten_NFTRental: MoveTemplate = {
  id: 'nft_rental',
  label: 'MystenLabs: NFT Rental (testnet)',
  defaultName: 'nft_rental',
  description: 'NFT renting via Kiosk Extension',
  detail:
    'ERC-4907-like renting on Sui using Kiosk Extension. Includes tests and C4 diagram boilerplate.',
  files,
};

import { FileMap, MoveTemplate, withCommon } from './types';

const README = withCommon(`
# MystenLabs Example: Token (Closed Loop)

End-to-end examples showing Sui’s Closed Loop Token patterns:

- **Rules**: allowlist / denylist / limiter (per action)
- **Simple Token**: all actions allowed, gated by denylist
- **Loyalty**: reward users; spend to buy gifts
- **Coffee Shop**: points without TokenPolicy (TreasuryCap only)
- **Gems & Sword**: buy gems with SUI, spend to buy items
- **Regulated Token**: action caps, allowlist (KYC), denylist

Source: https://github.com/MystenLabs/sui/tree/main/examples/move/token
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

    'sources/rules/allowlist_rule.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// A simple allowlist rule - allows only the addresses on the allowlist to
/// perform an Action.
module ${pkg}::allowlist_rule;

use sui::bag::{Self, Bag};
use sui::token::{Self, TokenPolicy, TokenPolicyCap, ActionRequest};

/// The \`sender\` or \`recipient\` is not on the allowlist.
const EUserNotAllowed: u64 = 0;

/// The Rule witness.
public struct Allowlist has drop {}

/// Verifies that the sender and the recipient (if set) are both on the
/// \`allowlist_rule\` for a given action.
///
/// Aborts if:
/// - there's no config
/// - the sender is not on the allowlist
/// - the recipient is not on the allowlist
public fun verify<T>(policy: &TokenPolicy<T>, request: &mut ActionRequest<T>, ctx: &mut TxContext) {
    assert!(has_config(policy), EUserNotAllowed);

    let config = config(policy);
    let sender = token::sender(request);
    let recipient = token::recipient(request);

    assert!(bag::contains(config, sender), EUserNotAllowed);

    if (option::is_some(&recipient)) {
        let recipient = *option::borrow(&recipient);
        assert!(bag::contains(config, recipient), EUserNotAllowed);
    };

    token::add_approval(Allowlist {}, request, ctx);
}

// === Protected: List Management ===

/// Adds records to the \`denylist_rule\` for a given action. The Policy
/// owner can batch-add records.
public fun add_records<T>(
    policy: &mut TokenPolicy<T>,
    cap: &TokenPolicyCap<T>,
    mut addresses: vector<address>,
    ctx: &mut TxContext,
) {
    if (!has_config(policy)) {
        token::add_rule_config(Allowlist {}, policy, cap, bag::new(ctx), ctx);
    };

    let config_mut = config_mut(policy, cap);
    while (vector::length(&addresses) > 0) {
        bag::add(config_mut, vector::pop_back(&mut addresses), true)
    }
}

/// Removes records from the \`denylist_rule\` for a given action. The Policy
/// owner can batch-remove records.
public fun remove_records<T>(
    policy: &mut TokenPolicy<T>,
    cap: &TokenPolicyCap<T>,
    mut addresses: vector<address>,
) {
    let config_mut = config_mut(policy, cap);

    while (vector::length(&addresses) > 0) {
        let record = vector::pop_back(&mut addresses);
        let _: bool = bag::remove(config_mut, record);
    };
}

// === Internal ===

fun has_config<T>(self: &TokenPolicy<T>): bool {
    token::has_rule_config_with_type<T, Allowlist, Bag>(self)
}

fun config<T>(self: &TokenPolicy<T>): &Bag {
    token::rule_config<T, Allowlist, Bag>(Allowlist {}, self)
}

fun config_mut<T>(self: &mut TokenPolicy<T>, cap: &TokenPolicyCap<T>): &mut Bag {
    token::rule_config_mut(Allowlist {}, self, cap)
}
`.trim(),

    'sources/rules/denylist_rule.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// An implementation of a simple \`Denylist\` for the Closed Loop system. For
/// demonstration purposes it is implemented as a \`VecSet\`, however for a larger
/// number of records there needs to be a different storage implementation
/// utilizing dynamic fields.
///
/// Denylist checks both the sender and the recipient of the transaction.
///
/// Notes:
/// - current implementation uses a separate dataset for each action, which will
/// be fixed / improved in the future;
/// - the current implementation is not optimized for a large number of records
/// and the final one will feature better collection type;
module ${pkg}::denylist_rule {
    use sui::bag::{Self, Bag};
    use sui::token::{Self, TokenPolicy, TokenPolicyCap, ActionRequest};

    /// Trying to \`verify\` but the sender or the recipient is on the denylist.
    const EUserBlocked: u64 = 0;

    /// The Rule witness.
    public struct Denylist has drop {}

    /// Verifies that the sender and the recipient (if set) are not on the
    /// denylist for the given action.
    public fun verify<T>(
        policy: &TokenPolicy<T>,
        request: &mut ActionRequest<T>,
        ctx: &mut TxContext,
    ) {
        // early return if no records are added;
        if (!has_config(policy)) {
            token::add_approval(Denylist {}, request, ctx);
            return
        };

        let config = config(policy);
        let sender = token::sender(request);
        let receiver = token::recipient(request);

        assert!(!bag::contains(config, sender), EUserBlocked);

        if (option::is_some(&receiver)) {
            let receiver = *option::borrow(&receiver);
            assert!(!bag::contains(config, receiver), EUserBlocked);
        };

        token::add_approval(Denylist {}, request, ctx);
    }

    // === Protected: List Management ===

    /// Adds records to the \`denylist_rule\` for a given action. The Policy
    /// owner can batch-add records.
    public fun add_records<T>(
        policy: &mut TokenPolicy<T>,
        cap: &TokenPolicyCap<T>,
        mut addresses: vector<address>,
        ctx: &mut TxContext,
    ) {
        if (!has_config(policy)) {
            token::add_rule_config(Denylist {}, policy, cap, bag::new(ctx), ctx);
        };

        let config_mut = config_mut(policy, cap);
        while (vector::length(&addresses) > 0) {
            bag::add(config_mut, vector::pop_back(&mut addresses), true)
        }
    }

    /// Removes records from the \`denylist_rule\` for a given action. The Policy
    /// owner can batch-remove records.
    public fun remove_records<T>(
        policy: &mut TokenPolicy<T>,
        cap: &TokenPolicyCap<T>,
        mut addresses: vector<address>,
        _ctx: &mut TxContext,
    ) {
        let config_mut = config_mut(policy, cap);

        while (vector::length(&addresses) > 0) {
            let record = vector::pop_back(&mut addresses);
            if (bag::contains(config_mut, record)) {
                let _: bool = bag::remove(config_mut, record);
            };
        };
    }

    // === Internal ===

    fun has_config<T>(self: &TokenPolicy<T>): bool {
        token::has_rule_config_with_type<T, Denylist, Bag>(self)
    }

    fun config<T>(self: &TokenPolicy<T>): &Bag {
        token::rule_config<T, Denylist, Bag>(Denylist {}, self)
    }

    fun config_mut<T>(self: &mut TokenPolicy<T>, cap: &TokenPolicyCap<T>): &mut Bag {
        token::rule_config_mut(Denylist {}, self, cap)
    }
}

#[test_only]
module ${pkg}::denylist_rule_tests {
    use ${pkg}::denylist_rule::{Self as denylist, Denylist};
    use std::option::{none, some};
    use std::string::utf8;
    use sui::token;
    use sui::token_test_utils::{Self as test, TEST};

    #[test]
    // Scenario: add a denylist with addresses, sender is not on the list and
    // transaction is confirmed.
    fun denylist_pass_not_on_the_list() {
        let ctx = &mut sui::tx_context::dummy();
        let (mut policy, cap) = test::get_policy(ctx);

        // first add the list for action and then add records
        token::add_rule_for_action<TEST, Denylist>(&mut policy, &cap, utf8(b"action"), ctx);
        denylist::add_records(&mut policy, &cap, vector[@0x1], ctx);

        let mut request = token::new_request(utf8(b"action"), 100, none(), none(), ctx);

        denylist::verify(&policy, &mut request, ctx);
        token::confirm_request(&policy, request, ctx);
        test::return_policy(policy, cap);
    }

    #[test, expected_failure(abort_code = ${pkg}::denylist_rule::EUserBlocked)]
    // Scenario: add a denylist with addresses, sender is on the list and
    // transaction fails with \`EUserBlocked\`.
    fun denylist_on_the_list_banned_fail() {
        let ctx = &mut sui::tx_context::dummy();
        let (mut policy, cap) = test::get_policy(ctx);

        token::add_rule_for_action<TEST, Denylist>(&mut policy, &cap, utf8(b"action"), ctx);
        denylist::add_records(&mut policy, &cap, vector[@0x0], ctx);

        let mut request = token::new_request(utf8(b"action"), 100, none(), none(), ctx);

        denylist::verify(&policy, &mut request, ctx);

        abort 1337
    }

    #[test, expected_failure(abort_code = ${pkg}::denylist_rule::EUserBlocked)]
    // Scenario: add a denylist with addresses, Recipient is on the list and
    // transaction fails with \`EUserBlocked\`.
    fun denylist_recipient_on_the_list_banned_fail() {
        let ctx = &mut sui::tx_context::dummy();
        let (mut policy, cap) = test::get_policy(ctx);

        token::add_rule_for_action<TEST, Denylist>(&mut policy, &cap, utf8(b"action"), ctx);
        denylist::add_records(&mut policy, &cap, vector[@0x1], ctx);

        let mut request = token::new_request(utf8(b"action"), 100, some(@0x1), none(), ctx);

        denylist::verify(&policy, &mut request, ctx);

        abort 1337
    }
}
`.trim(),

    'sources/rules/limiter_rule.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// An example of a Rule for the Closed Loop Token which limits the amount per
/// operation. Can be used to limit any action (eg transfer, toCoin, fromCoin).
module ${pkg}::limiter_rule {
    use std::string::String;
    use sui::token::{Self, TokenPolicy, TokenPolicyCap, ActionRequest};
    use sui::vec_map::{Self, VecMap};

    /// Trying to perform an action that exceeds the limit.
    const ELimitExceeded: u64 = 0;

    /// The Rule witness.
    public struct Limiter has drop {}

    /// The Config object for the \`lo
    public struct Config has drop, store {
        /// Mapping of Action -> Limit
        limits: VecMap<String, u64>,
    }

    /// Verifies that the request does not exceed the limit and adds an approval
    /// to the \`ActionRequest\`.
    public fun verify<T>(
        policy: &TokenPolicy<T>,
        request: &mut ActionRequest<T>,
        ctx: &mut TxContext,
    ) {
        if (!token::has_rule_config<T, Limiter>(policy)) {
            return token::add_approval(Limiter {}, request, ctx)
        };

        let config: &Config = token::rule_config(Limiter {}, policy);
        if (!vec_map::contains(&config.limits, &token::action(request))) {
            return token::add_approval(Limiter {}, request, ctx)
        };

        let action_limit = *vec_map::get(&config.limits, &token::action(request));

        assert!(token::amount(request) <= action_limit, ELimitExceeded);
        token::add_approval(Limiter {}, request, ctx);
    }

    /// Updates the config for the \`Limiter\` rule. Uses the \`VecMap\` to store
    /// the limits for each action.
    public fun set_config<T>(
        policy: &mut TokenPolicy<T>,
        cap: &TokenPolicyCap<T>,
        limits: VecMap<String, u64>,
        ctx: &mut TxContext,
    ) {
        // if there's no stored config for the rule, add a new one
        if (!token::has_rule_config<T, Limiter>(policy)) {
            let config = Config { limits };
            token::add_rule_config(Limiter {}, policy, cap, config, ctx);
        } else {
            let config: &mut Config = token::rule_config_mut(Limiter {}, policy, cap);
            config.limits = limits;
        }
    }

    /// Returns the config for the \`Limiter\` rule.
    public fun get_config<T>(policy: &TokenPolicy<T>): VecMap<String, u64> {
        token::rule_config<T, Limiter, Config>(Limiter {}, policy).limits
    }
}

#[test_only]
module ${pkg}::limiter_rule_tests {
    use ${pkg}::limiter_rule::{Self as limiter, Limiter};
    use std::option::none;
    use std::string::utf8;
    use sui::token;
    use sui::token_test_utils::{Self as test, TEST};
    use sui::vec_map;

    #[test]
    // Scenario: add a limiter rule for 100 tokens per operation, verify that
    // the request with 100 tokens is confirmed
    fun add_limiter_default() {
        let ctx = &mut sui::tx_context::dummy();
        let (mut policy, cap) = test::get_policy(ctx);

        token::add_rule_for_action<TEST, Limiter>(&mut policy, &cap, utf8(b"action"), ctx);

        let mut request = token::new_request(utf8(b"action"), 100, none(), none(), ctx);

        limiter::verify(&policy, &mut request, ctx);

        token::confirm_request(&policy, request, ctx);
        test::return_policy(policy, cap);
    }

    #[test]
    // Scenario: add a limiter rule for 100 tokens per operation, verify that
    // the request with 100 tokens is confirmed; then remove the rule and verify
    // that the request with 100 tokens is not confirmed and repeat step (1)
    fun add_remove_limiter() {
        let ctx = &mut sui::tx_context::dummy();
        let (mut policy, cap) = test::get_policy(ctx);

        let mut config = vec_map::empty();
        vec_map::insert(&mut config, utf8(b"action"), 100);
        limiter::set_config(&mut policy, &cap, config, ctx);

        // adding limiter - confirmation required
        token::add_rule_for_action<TEST, Limiter>(&mut policy, &cap, utf8(b"action"), ctx);
        {
            let mut request = token::new_request(utf8(b"action"), 100, none(), none(), ctx);
            limiter::verify(&policy, &mut request, ctx);
            token::confirm_request(&policy, request, ctx);
        };

        // limiter removed - no confirmation required
        token::remove_rule_for_action<TEST, Limiter>(&mut policy, &cap, utf8(b"action"), ctx);
        {
            let request = token::new_request(utf8(b"action"), 100, none(), none(), ctx);
            token::confirm_request(&policy, request, ctx);
        };

        // limiter added but no limit now
        limiter::set_config(&mut policy, &cap, vec_map::empty(), ctx);
        token::add_rule_for_action<TEST, Limiter>(&mut policy, &cap, utf8(b"action"), ctx);
        {
            let mut request = token::new_request(utf8(b"action"), 100, none(), none(), ctx);
            limiter::verify(&policy, &mut request, ctx);
            token::confirm_request(&policy, request, ctx);
        };

        test::return_policy(policy, cap);
    }

    #[test, expected_failure(abort_code = ${pkg}::limiter_rule::ELimitExceeded)]
    // Scenario: add a limiter rule for 100 tokens per operation, verify that
    // the request with 101 tokens aborts with \`ELimitExceeded\`
    fun add_limiter_limit_exceeded_fail() {
        let ctx = &mut sui::tx_context::dummy();
        let (mut policy, cap) = test::get_policy(ctx);

        let mut config = vec_map::empty();
        vec_map::insert(&mut config, utf8(b"action"), 100);
        limiter::set_config(&mut policy, &cap, config, ctx);

        token::add_rule_for_action<TEST, Limiter>(&mut policy, &cap, utf8(b"action"), ctx);

        let mut request = token::new_request(utf8(b"action"), 101, none(), none(), ctx);
        limiter::verify(&policy, &mut request, ctx);

        abort 1337
    }
}
`.trim(),

    'sources/coffee.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// This example illustrates how to use the \`Token\` without a \`TokenPolicy\`. And
/// only rely on \`TreasuryCap\` for minting and burning tokens.
module ${pkg}::coffee;

use sui::balance::{Self, Balance};
use sui::coin::{Self, TreasuryCap, Coin};
use sui::sui::SUI;
use sui::token::{Self, Token};
use sui::tx_context::sender;

/// Error code for incorrect amount.
const EIncorrectAmount: u64 = 0;
/// Trying to claim a free coffee without enough points.
/// Or trying to transfer but not enough points to pay the commission.
const ENotEnoughPoints: u64 = 1;

/// 10 SUI for a coffee.
const COFFEE_PRICE: u64 = 10_000_000_000;

/// OTW for the Token.
public struct COFFEE has drop {}

/// The shop that sells Coffee and allows to buy a Coffee if the customer
/// has 10 SUI or 4 COFFEE points.
public struct CoffeeShop has key {
    id: UID,
    /// The treasury cap for the \`COFFEE\` points.
    coffee_points: TreasuryCap<COFFEE>,
    /// The SUI balance of the shop; the shop can sell Coffee for SUI.
    balance: Balance<SUI>,
}

/// Event marking that a Coffee was purchased; transaction sender serves as
/// the customer ID.
public struct CoffeePurchased has copy, drop, store {}

// Create and share the \`CoffeeShop\` object.
#[allow(deprecated_usage)]
fun init(otw: COFFEE, ctx: &mut TxContext) {
    let (coffee_points, metadata) = coin::create_currency(
        otw,
        0,
        b"COFFEE",
        b"Coffee Point",
        b"Buy 4 coffees and get 1 free",
        std::option::none(),
        ctx,
    );

    sui::transfer::public_freeze_object(metadata);
    sui::transfer::share_object(CoffeeShop {
        coffee_points,
        id: object::new(ctx),
        balance: balance::zero(),
    });
}

/// Buy a coffee from the shop. Emitted event is tracked by the real coffee
/// shop and the customer gets a free coffee after 4 purchases.
public fun buy_coffee(app: &mut CoffeeShop, payment: Coin<SUI>, ctx: &mut TxContext) {
    // Check if the customer has enough SUI to pay for the coffee.
    assert!(coin::value(&payment) == COFFEE_PRICE, EIncorrectAmount);

    let token = token::mint(&mut app.coffee_points, 1, ctx);
    let request = token::transfer(token, ctx.sender(), ctx);

    token::confirm_with_treasury_cap(&mut app.coffee_points, request, ctx);
    coin::put(&mut app.balance, payment);
    sui::event::emit(CoffeePurchased {})
}

/// Claim a free coffee from the shop. Emitted event is tracked by the real
/// coffee shop and the customer gets a free coffee after 4 purchases. The
/// \`COFFEE\` tokens are spent.
public fun claim_free(app: &mut CoffeeShop, points: Token<COFFEE>, ctx: &mut TxContext) {
    // Check if the customer has enough \`COFFEE\` points to claim a free one.
    assert!(token::value(&points) == 4, EIncorrectAmount);

    // While we could use \`burn\`, spend illustrates another way of doing this
    let request = token::spend(points, ctx);
    token::confirm_with_treasury_cap(&mut app.coffee_points, request, ctx);
    sui::event::emit(CoffeePurchased {})
}

/// We allow transfer of \`COFFEE\` points to other customers but we charge 1
/// \`COFFEE\` point for the transfer.
public fun transfer(
    app: &mut CoffeeShop,
    mut points: Token<COFFEE>,
    recipient: address,
    ctx: &mut TxContext,
) {
    assert!(token::value(&points) > 1, ENotEnoughPoints);
    let commission = token::split(&mut points, 1, ctx);
    let request = token::transfer(points, recipient, ctx);

    token::confirm_with_treasury_cap(&mut app.coffee_points, request, ctx);
    token::burn(&mut app.coffee_points, commission);
}
`.trim(),

    'sources/gems.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// This is a simple example of a permissionless module for an imaginary game
/// that sells swords for Gems. Gems are an in-game currency that can be bought
/// with SUI.
module ${pkg}::sword {
    use ${pkg}::gem::GEM;
    use sui::token::{Self, Token, ActionRequest};

    /// Trying to purchase a sword with an incorrect amount.
    const EWrongAmount: u64 = 0;

    /// The price of a sword in Gems.
    const SWORD_PRICE: u64 = 10;

    /// A game item that can be purchased with Gems.
    public struct Sword has key, store { id: UID }

    /// Purchase a sword with Gems.
    public fun buy_sword(gems: Token<GEM>, ctx: &mut TxContext): (Sword, ActionRequest<GEM>) {
        assert!(SWORD_PRICE == token::value(&gems), EWrongAmount);
        (Sword { id: object::new(ctx) }, token::spend(gems, ctx))
    }
}

/// Module that defines the in-game currency: GEMs which can be purchased with
/// SUI and used to buy swords (in the \`sword\` module).
module ${pkg}::gem {
    use std::option::none;
    use std::string::{Self, String};
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::sui::SUI;
    use sui::token::{Self, Token, ActionRequest};
    use sui::tx_context::sender;

    /// Trying to purchase Gems with an unexpected amount.
    const EUnknownAmount: u64 = 0;

    /// 10 SUI is the price of a small bundle of Gems.
    const SMALL_BUNDLE: u64 = 10_000_000_000;
    const SMALL_AMOUNT: u64 = 100;

    /// 100 SUI is the price of a medium bundle of Gems.
    const MEDIUM_BUNDLE: u64 = 100_000_000_000;
    const MEDIUM_AMOUNT: u64 = 5_000;

    /// 1000 SUI is the price of a large bundle of Gems.
    /// This is the best deal.
    const LARGE_BUNDLE: u64 = 1_000_000_000_000;
    const LARGE_AMOUNT: u64 = 100_000;

    /// Gems can be purchased through the \`Store\`.
    public struct GemStore has key {
        id: UID,
        /// Profits from selling Gems.
        profits: Balance<SUI>,
        /// The Treasury Cap for the in-game currency.
        gem_treasury: TreasuryCap<GEM>,
    }

    /// The OTW to create the in-game currency.
    public struct GEM has drop {}

    // In the module initializer we create the in-game currency and define the
    // rules for different types of actions.
    #[allow(deprecated_usage)]
    fun init(otw: GEM, ctx: &mut TxContext) {
        let (treasury_cap, coin_metadata) = coin::create_currency(
            otw,
            0,
            b"GEM",
            b"Capy Gems", // otw, decimal, symbol, name
            b"In-game currency for Capy Miners",
            none(), // description, url
            ctx,
        );

        // create a \`TokenPolicy\` for GEMs
        let (mut policy, cap) = token::new_policy(&treasury_cap, ctx);

        token::allow(&mut policy, &cap, buy_action(), ctx);
        token::allow(&mut policy, &cap, token::spend_action(), ctx);

        // create and share the GemStore
        transfer::share_object(GemStore {
            id: object::new(ctx),
            gem_treasury: treasury_cap,
            profits: balance::zero(),
        });

        // deal with \`TokenPolicy\`, \`CoinMetadata\` and \`TokenPolicyCap\`
        transfer::public_freeze_object(coin_metadata);
        transfer::public_transfer(cap, ctx.sender());
        token::share_policy(policy);
    }

    /// Purchase Gems from the GemStore. Very silly value matching against module
    /// constants...
    public fun buy_gems(
        self: &mut GemStore,
        payment: Coin<SUI>,
        ctx: &mut TxContext,
    ): (Token<GEM>, ActionRequest<GEM>) {
        let amount = coin::value(&payment);
        let purchased = if (amount == SMALL_BUNDLE) {
            SMALL_AMOUNT
        } else if (amount == MEDIUM_BUNDLE) {
            MEDIUM_AMOUNT
        } else if (amount == LARGE_BUNDLE) {
            LARGE_AMOUNT
        } else {
            abort EUnknownAmount
        };

        coin::put(&mut self.profits, payment);

        // create custom request and mint some Gems
        let gems = token::mint(&mut self.gem_treasury, purchased, ctx);
        let req = token::new_request(buy_action(), purchased, none(), none(), ctx);

        (gems, req)
    }

    /// The name of the \`buy\` action in the \`GemStore\`.
    public fun buy_action(): String { string::utf8(b"buy") }
}
`.trim(),

    'sources/loyalty.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// This module illustrates a Closed Loop Loyalty Token. The \`Token\` is sent to
/// users as a reward for their loyalty by the application Admin. The \`Token\`
/// can be used to buy a \`Gift\` in the shop.
///
/// Actions:
/// - spend - spend the token in the shop
module ${pkg}::loyalty;

use sui::coin::{Self, TreasuryCap};
use sui::token::{Self, ActionRequest, Token};

/// Token amount does not match the \`GIFT_PRICE\`.
const EIncorrectAmount: u64 = 0;

/// The price for the \`Gift\`.
const GIFT_PRICE: u64 = 10;

/// The OTW for the Token / Coin.
public struct LOYALTY has drop {}

/// This is the Rule requirement for the \`GiftShop\`. The Rules don't need
/// to be separate applications, some rules make sense to be part of the
/// application itself, like this one.
public struct GiftShop has drop {}

/// The Gift object - can be purchased for 10 tokens.
public struct Gift has key, store {
    id: UID,
}

// Create a new LOYALTY currency, create a \`TokenPolicy\` for it and allow
// everyone to spend \`Token\`s if they were \`reward\`ed.
#[allow(deprecated_usage)]
fun init(otw: LOYALTY, ctx: &mut TxContext) {
    let (treasury_cap, coin_metadata) = coin::create_currency(
        otw,
        0, // no decimals
        b"LOY", // symbol
        b"Loyalty Token", // name
        b"Token for Loyalty", // description
        option::none(), // url
        ctx,
    );

    let (mut policy, policy_cap) = token::new_policy(&treasury_cap, ctx);

    // but we constrain spend by this shop:
    token::add_rule_for_action<LOYALTY, GiftShop>(
        &mut policy,
        &policy_cap,
        token::spend_action(),
        ctx,
    );

    token::share_policy(policy);

    transfer::public_freeze_object(coin_metadata);
    transfer::public_transfer(policy_cap, tx_context::sender(ctx));
    transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
}

/// Handy function to reward users. Can be called by the application admin
/// to reward users for their loyalty :)
///
/// \`Mint\` is available to the holder of the \`TreasuryCap\` by default and
/// hence does not need to be confirmed; however, the \`transfer\` action
/// does require a confirmation and can be confirmed with \`TreasuryCap\`.
public fun reward_user(
    cap: &mut TreasuryCap<LOYALTY>,
    amount: u64,
    recipient: address,
    ctx: &mut TxContext,
) {
    let token = token::mint(cap, amount, ctx);
    let req = token::transfer(token, recipient, ctx);

    token::confirm_with_treasury_cap(cap, req, ctx);
}

/// Buy a gift for 10 tokens. The \`Gift\` is received, and the \`Token\` is
/// spent (stored in the \`ActionRequest\`'s \`burned_balance\` field).
public fun buy_a_gift(token: Token<LOYALTY>, ctx: &mut TxContext): (Gift, ActionRequest<LOYALTY>) {
    assert!(token::value(&token) == GIFT_PRICE, EIncorrectAmount);

    let gift = Gift { id: object::new(ctx) };
    let mut req = token::spend(token, ctx);

    // only required because we've set this rule
    token::add_approval(GiftShop {}, &mut req, ctx);

    (gift, req)
}
`.trim(),

    'sources/regulated_token.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// This example demonstrates how to use Closed Loop to create a regulated coin
/// that follows different regulatory requirements for actions:
///
/// 1. A new Token can only be minted by admin (out of scope)
/// 2. Tokens can only be transferred between KYC-d (approved) addresses
/// 3. A single transfer can't exceed 3000.00 REG
/// 4. A single "withdraw" operation \`to_coin\` can't exceed 1000.00 REG
/// 5. All actions are regulated by a denylist rule
///
/// With this set of rules new accounts can either be created by admin (with a
/// mint and transfer operation) or if the account is KYC-d it can be created
/// with a transfer operation from an existing account. Similarly, an account
/// that has "Coin<REG>" can only convert it to \`Token<REG>\` if it's KYC-d.
///
/// Notes:
///
/// - best analogy for regulated account (Token) and unregulated account (Coin)
/// is a Bank account and Cash. Bank account is regulated and requires KYC to
/// open, Cash is unregulated and can be used by anyone and passed freely.
/// However should someone decide to put Cash into a Bank account, the Bank will
/// require KYC.
///
/// - KYC in this example is represented by an allowlist rule
module ${pkg}::regulated_token {
    use ${pkg}::allowlist_rule::Allowlist;
    use ${pkg}::denylist_rule::Denylist;
    use ${pkg}::limiter_rule::{Self as limiter, Limiter};
    use sui::coin::{Self, TreasuryCap};
    use sui::token::{Self, TokenPolicy, TokenPolicyCap};
    use sui::tx_context::sender;
    use sui::vec_map;

    /// OTW and the type for the Token.
    public struct REGULATED_TOKEN has drop {}

    // Most of the magic happens in the initializer for the demonstration
    // purposes; however half of what's happening here could be implemented as
    // a single / set of PTBs.
    fun init(otw: REGULATED_TOKEN, ctx: &mut TxContext) {
        let treasury_cap = create_currency(otw, ctx);
        let (mut policy, cap) = token::new_policy(&treasury_cap, ctx);

        set_rules(&mut policy, &cap, ctx);

        transfer::public_transfer(treasury_cap, ctx.sender());
        transfer::public_transfer(cap, ctx.sender());
        token::share_policy(policy);
    }

    /// Internal: not necessary, but moving this call to a separate function for
    /// better visibility of the Closed Loop setup in \`init\` and easier testing.
    public(package) fun set_rules<T>(
        policy: &mut TokenPolicy<T>,
        cap: &TokenPolicyCap<T>,
        ctx: &mut TxContext,
    ) {
        // Create a denylist rule and add it to every action
        // Now all actions are allowed but require a denylist
        token::add_rule_for_action<T, Denylist>(policy, cap, token::spend_action(), ctx);
        token::add_rule_for_action<T, Denylist>(policy, cap, token::to_coin_action(), ctx);
        token::add_rule_for_action<T, Denylist>(policy, cap, token::transfer_action(), ctx);
        token::add_rule_for_action<T, Denylist>(policy, cap, token::from_coin_action(), ctx);

        // Set limits for each action:
        // transfer - 3000.00 REG, to_coin - 1000.00 REG
        token::add_rule_for_action<T, Limiter>(policy, cap, token::transfer_action(), ctx);
        token::add_rule_for_action<T, Limiter>(policy, cap, token::to_coin_action(), ctx);

        let config = {
            let mut config = vec_map::empty();
            vec_map::insert(&mut config, token::transfer_action(), 3000_000000);
            vec_map::insert(&mut config, token::to_coin_action(), 1000_000000);
            config
        };

        limiter::set_config(policy, cap, config, ctx);

        // Using allowlist to mock a KYC process; transfer and from_coin can
        // only be performed by KYC-d (allowed) addresses. Just like a Bank
        // account.
        token::add_rule_for_action<T, Allowlist>(policy, cap, token::from_coin_action(), ctx);
        token::add_rule_for_action<T, Allowlist>(policy, cap, token::transfer_action(), ctx);
    }

    /// Internal: not necessary, but moving this call to a separate function for
    /// better visibility of the Closed Loop setup in \`init\`.
    #[allow(deprecated_usage)]
    fun create_currency<T: drop>(otw: T, ctx: &mut TxContext): TreasuryCap<T> {
        let (treasury_cap, metadata) = coin::create_currency(
            otw,
            6,
            b"REG",
            b"Regulated Coin",
            b"Coin that illustrates different regulatory requirements",
            option::none(),
            ctx,
        );

        transfer::public_freeze_object(metadata);
        treasury_cap
    }
}

#[test_only]
/// Implements tests for most common scenarios for the regulated token example.
/// We don't test the currency itself but rather use the same set of regulations
/// on a test currency.
module ${pkg}::regulated_token_tests {
    use ${pkg}::allowlist_rule as allowlist;
    use ${pkg}::denylist_rule as denylist;
    use ${pkg}::limiter_rule as limiter;
    use ${pkg}::regulated_token::set_rules;
    use sui::coin;
    use sui::token::{Self, TokenPolicy, TokenPolicyCap};
    use sui::token_test_utils::{Self as test, TEST};

    const ALICE: address = @0x0;
    const BOB: address = @0x1;

    // === Limiter Tests ===

    #[test]
    /// Transfer 3000 REG to self
    fun test_limiter_transfer_allowed_pass() {
        let ctx = &mut test::ctx(ALICE);
        let (policy, cap) = policy_with_allowlist(ctx);

        let token = test::mint(3000_000000, ctx);
        let mut request = token::transfer(token, ALICE, ctx);

        limiter::verify(&policy, &mut request, ctx);
        denylist::verify(&policy, &mut request, ctx);
        allowlist::verify(&policy, &mut request, ctx);

        token::confirm_request(&policy, request, ctx);
        test::return_policy(policy, cap);
    }

    #[test, expected_failure(abort_code = limiter::ELimitExceeded)]
    /// Try to transfer more than 3000.00 REG.
    fun test_limiter_transfer_to_not_allowed_fail() {
        let ctx = &mut test::ctx(ALICE);
        let (policy, _cap) = policy_with_allowlist(ctx);

        let token = test::mint(3001_000000, ctx);
        let mut request = token::transfer(token, ALICE, ctx);

        limiter::verify(&policy, &mut request, ctx);

        abort 1337
    }

    #[test]
    /// Turn 1000 REG into Coin from.
    fun test_limiter_to_coin_allowed_pass() {
        let ctx = &mut test::ctx(ALICE);
        let (policy, cap) = policy_with_allowlist(ctx);

        let token = test::mint(1000_000000, ctx);
        let (coin, mut request) = token::to_coin(token, ctx);

        limiter::verify(&policy, &mut request, ctx);
        denylist::verify(&policy, &mut request, ctx);
        allowlist::verify(&policy, &mut request, ctx);

        token::confirm_request(&policy, request, ctx);
        test::return_policy(policy, cap);
        coin::burn_for_testing(coin);
    }

    #[test, expected_failure(abort_code = limiter::ELimitExceeded)]
    /// Try to convert more than 1000.00 REG in a single operation.
    fun test_limiter_to_coin_exceeded_fail() {
        let ctx = &mut test::ctx(ALICE);
        let (policy, _cap) = policy_with_allowlist(ctx);

        let token = test::mint(1001_000000, ctx);
        let (_coin, mut request) = token::to_coin(token, ctx);

        limiter::verify(&policy, &mut request, ctx);

        abort 1337
    }

    // === Allowlist Tests ===

    // Test from allowed account is already covered in the
    // \`test_limiter_transfer_allowed_pass\`

    #[test, expected_failure(abort_code = allowlist::EUserNotAllowed)]
    /// Try to \`transfer\` to a not allowed account.
    fun test_allowlist_transfer_to_not_allowed_fail() {
        let ctx = &mut test::ctx(ALICE);
        let (policy, _cap) = policy_with_allowlist(ctx);

        let token = test::mint(1000_000000, ctx);
        let mut request = token::transfer(token, BOB, ctx);

        allowlist::verify(&policy, &mut request, ctx);

        abort 1337
    }

    #[test, expected_failure(abort_code = allowlist::EUserNotAllowed)]
    /// Try to \`from_coin\` from a not allowed account.
    fun test_allowlist_from_coin_not_allowed_fail() {
        let ctx = &mut test::ctx(ALICE);
        let (mut policy, cap) = test::get_policy(ctx);

        set_rules(&mut policy, &cap, ctx);

        let coin = coin::mint_for_testing(1000_000000, ctx);
        let (_token, mut request) = token::from_coin(coin, ctx);

        allowlist::verify(&policy, &mut request, ctx);

        abort 1337
    }

    // === Denylist Tests ===

    #[test, expected_failure(abort_code = denylist::EUserBlocked)]
    /// Try to \`transfer\` from a blocked account.
    fun test_denylist_transfer_fail() {
        let ctx = &mut test::ctx(ALICE);
        let (policy, _cap) = policy_with_denylist(ctx);

        let token = test::mint(1000_000000, ctx);
        let mut request = token::transfer(token, BOB, ctx);

        denylist::verify(&policy, &mut request, ctx);

        abort 1337
    }

    #[test, expected_failure(abort_code = denylist::EUserBlocked)]
    /// Try to \`transfer\` to a blocked account.
    fun test_denylist_transfer_to_recipient_fail() {
        let ctx = &mut test::ctx(ALICE);
        let (policy, _cap) = policy_with_denylist(ctx);

        let token = test::mint(1000_000000, ctx);
        let mut request = token::transfer(token, BOB, ctx);

        denylist::verify(&policy, &mut request, ctx);

        abort 1337
    }

    #[test, expected_failure(abort_code = denylist::EUserBlocked)]
    /// Try to \`spend\` from a blocked account.
    fun test_denylist_spend_fail() {
        let ctx = &mut test::ctx(BOB);
        let (mut policy, cap) = test::get_policy(ctx);

        set_rules(&mut policy, &cap, ctx);
        denylist::add_records(&mut policy, &cap, vector[BOB], ctx);

        let token = test::mint(1000_000000, ctx);
        let mut request = token::spend(token, ctx);

        denylist::verify(&policy, &mut request, ctx);

        abort 1337
    }

    #[test, expected_failure(abort_code = denylist::EUserBlocked)]
    /// Try to \`to_coin\` from a blocked account.
    fun test_denylist_to_coin_fail() {
        let ctx = &mut test::ctx(ALICE);
        let (policy, _cap) = policy_with_denylist(ctx);

        let token = test::mint(1000_000000, ctx);
        let (_coin, mut request) = token::to_coin(token, ctx);

        denylist::verify(&policy, &mut request, ctx);

        abort 1337
    }

    #[test, expected_failure(abort_code = denylist::EUserBlocked)]
    /// Try to \`from_coin\` from a blocked account.
    fun test_denylist_from_coin_fail() {
        let ctx = &mut test::ctx(ALICE);
        let (policy, _cap) = policy_with_denylist(ctx);

        let coin = coin::mint_for_testing(1000_000000, ctx);
        let (_token, mut request) = token::from_coin(coin, ctx);

        denylist::verify(&policy, &mut request, ctx);

        abort 1337
    }

    /// Internal: prepare a policy with a denylist rule where sender is banned;
    fun policy_with_denylist(ctx: &mut TxContext): (TokenPolicy<TEST>, TokenPolicyCap<TEST>) {
        let (mut policy, cap) = test::get_policy(ctx);
        set_rules(&mut policy, &cap, ctx);

        denylist::add_records(&mut policy, &cap, vector[ALICE], ctx);
        (policy, cap)
    }

    /// Internal: prepare a policy with an allowlist rule where sender is allowed;
    fun policy_with_allowlist(ctx: &mut TxContext): (TokenPolicy<TEST>, TokenPolicyCap<TEST>) {
        let (mut policy, cap) = test::get_policy(ctx);
        set_rules(&mut policy, &cap, ctx);

        allowlist::add_records(&mut policy, &cap, vector[ALICE], ctx);
        (policy, cap)
    }
}
`.trim(),

    'sources/simple_token.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// Create a simple Token with Denylist for every action; all four default
/// actions are allowed as long as the user is not on the denylist.
module ${pkg}::simple_token {
    use ${pkg}::denylist_rule::Denylist;
    use sui::coin::{Self, TreasuryCap};
    use sui::token::{Self, TokenPolicy, TokenPolicyCap};
    use sui::tx_context::sender;

    /// OTW and the type for the Token.
    public struct SIMPLE_TOKEN has drop {}

    // Most of the magic happens in the initializer for the demonstration
    // purposes; however half of what's happening here could be implemented as
    // a single / set of PTBs.
    fun init(otw: SIMPLE_TOKEN, ctx: &mut TxContext) {
        let treasury_cap = create_currency(otw, ctx);
        let (mut policy, cap) = token::new_policy(&treasury_cap, ctx);

        set_rules(&mut policy, &cap, ctx);

        transfer::public_transfer(treasury_cap, ctx.sender());
        transfer::public_transfer(cap, ctx.sender());
        token::share_policy(policy);
    }

    /// Internal: not necessary, but moving this call to a separate function for
    /// better visibility of the Closed Loop setup in \`init\` and easier testing.
    public(package) fun set_rules<T>(
        policy: &mut TokenPolicy<T>,
        cap: &TokenPolicyCap<T>,
        ctx: &mut TxContext,
    ) {
        // Create a denylist rule and add it to every action
        // Now all actions are allowed but require a denylist
        token::add_rule_for_action<T, Denylist>(policy, cap, token::spend_action(), ctx);
        token::add_rule_for_action<T, Denylist>(policy, cap, token::to_coin_action(), ctx);
        token::add_rule_for_action<T, Denylist>(policy, cap, token::transfer_action(), ctx);
        token::add_rule_for_action<T, Denylist>(policy, cap, token::from_coin_action(), ctx);
    }

    /// Internal: not necessary, but moving this call to a separate function for
    /// better visibility of the Closed Loop setup in \`init\`.
    #[allow(deprecated_usage)]
    fun create_currency<T: drop>(otw: T, ctx: &mut TxContext): TreasuryCap<T> {
        let (treasury_cap, metadata) = coin::create_currency(
            otw,
            6,
            b"SMPL",
            b"Simple Token",
            b"Token that showcases denylist",
            option::none(),
            ctx,
        );

        transfer::public_freeze_object(metadata);
        treasury_cap
    }
}

#[test_only]
/// Implements tests for most common scenarios for the regulated coin example.
/// We don't test the currency itself but rather use the same set of regulations
/// on a test currency.
module ${pkg}::simple_token_tests {
    use ${pkg}::denylist_rule as denylist;
    use ${pkg}::simple_token::set_rules;
    use sui::coin;
    use sui::token::{Self, TokenPolicy, TokenPolicyCap};
    use sui::token_test_utils::{Self as test, TEST};

    const ALICE: address = @0x0;
    const BOB: address = @0x1;

    // === Denylist Tests ===

    #[test, expected_failure(abort_code = denylist::EUserBlocked)]
    /// Try to \`transfer\` from a blocked account.
    fun test_denylist_transfer_fail() {
        let ctx = &mut test::ctx(@0x0);
        let (policy, _cap) = policy_with_denylist(ctx);

        let token = test::mint(1000_000000, ctx);
        let mut request = token::transfer(token, BOB, ctx);

        denylist::verify(&policy, &mut request, ctx);

        abort 1337
    }

    #[test, expected_failure(abort_code = denylist::EUserBlocked)]
    /// Try to \`transfer\` to a blocked account.
    fun test_denylist_transfer_to_recipient_fail() {
        let ctx = &mut test::ctx(@0x0);
        let (policy, _cap) = policy_with_denylist(ctx);

        let token = test::mint(1000_000000, ctx);
        let mut request = token::transfer(token, BOB, ctx);

        denylist::verify(&policy, &mut request, ctx);

        abort 1337
    }

    #[test, expected_failure(abort_code = denylist::EUserBlocked)]
    /// Try to \`spend\` from a blocked account.
    fun test_denylist_spend_fail() {
        let ctx = &mut test::ctx(@0x0);
        let (mut policy, cap) = test::get_policy(ctx);

        set_rules(&mut policy, &cap, ctx);
        denylist::add_records(&mut policy, &cap, vector[BOB], ctx);

        let token = test::mint(1000_000000, ctx);
        let mut request = token::transfer(token, BOB, ctx);

        denylist::verify(&policy, &mut request, ctx);

        abort 1337
    }

    #[test, expected_failure(abort_code = denylist::EUserBlocked)]
    /// Try to \`to_coin\` from a blocked account.
    fun test_denylist_to_coin_fail() {
        let ctx = &mut test::ctx(@0x0);
        let (policy, _cap) = policy_with_denylist(ctx);

        let token = test::mint(1000_000000, ctx);
        let (_coin, mut request) = token::to_coin(token, ctx);

        denylist::verify(&policy, &mut request, ctx);

        abort 1337
    }

    #[test, expected_failure(abort_code = denylist::EUserBlocked)]
    /// Try to \`from_coin\` from a blocked account.
    fun test_denylist_from_coin_fail() {
        let ctx = &mut test::ctx(@0x0);
        let (policy, _cap) = policy_with_denylist(ctx);

        let coin = coin::mint_for_testing(1000_000000, ctx);
        let (_token, mut request) = token::from_coin(coin, ctx);

        denylist::verify(&policy, &mut request, ctx);

        abort 1337
    }

    /// Internal: prepare a policy with a denylist rule where sender is banned;
    fun policy_with_denylist(ctx: &mut TxContext): (TokenPolicy<TEST>, TokenPolicyCap<TEST>) {
        let (mut policy, cap) = test::get_policy(ctx);
        set_rules(&mut policy, &cap, ctx);

        denylist::add_records(&mut policy, &cap, vector[ALICE], ctx);
        (policy, cap)
    }
}
`.trim(),
  };
}

export const MoveTemplate_Mysten_Token: MoveTemplate = {
  id: 'mysten_token',
  label: 'MystenLabs: Token (Closed Loop)',
  defaultName: 'token',
  description: 'Closed loop tokens',
  detail:
    'Allowlist, denylist, limiter rules plus loyalty, coffee, gems, and regulated flows.',
  files,
};

import { FileMap, MoveTemplate, withCommon } from './types';

export const README = withCommon(`
# Kiosk (Sui Move Intro Course)

A simple Kiosk example with a \`TShirt\` type, supporting place, withdraw, list, buy, and Transfer Policy rules (fixed royalty, dummy).

Source: https://github.com/sui-foundation/sui-move-intro-course/tree/main/unit-five/example_projects/kiosk

## Next steps
1. Open \`sources/kiosk.move\` and supporting rule files.
2. Build the package with \`sui move build\`.
3. Deploy with \`sui client publish .\` and test kiosk operations.
`);

const moveToml = (pkg: string) =>
  `
[package]
name = "${pkg}"
version = "0.0.1"
edition = "2024.beta"

# edition = "2024.alpha" # To use the Move 2024 edition, currently in alpha
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
sui = "0x2"

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

    'sources/kiosk.move': `
/// Kiosk module with a demo object and basic functions
module ${pkg}::kiosk;

use sui::coin::Coin;
use sui::kiosk::{Self, Kiosk, KioskOwnerCap};
// W02021 duplicate alias (kept as comment for clarity)
// use sui::object::{Self as object, UID};
use sui::package::{Self as package, Publisher};
// use sui::transfer;                 // alias provided by default
// use sui::tx_context::TxContext;    // alias provided by default
use sui::sui::SUI;
use sui::transfer_policy::{Self as transfer_policy, TransferPolicy, TransferRequest};

/// Demo object type
public struct TShirt has key, store {
    // UID is in scope by default
    id: UID,
}

public struct KIOSK has drop {}

/// Module initialization (publisher registration)
fun init(otw: KIOSK, ctx: &mut TxContext) {
    let publisher = package::claim(otw, ctx);
    // transfer::public_transfer(publisher, transfer::sender(ctx)); // wrong
    transfer::public_transfer(publisher, tx_context::sender(ctx));
}

/// Mint a TShirt object
public fun new_tshirt(ctx: &mut TxContext): TShirt {
    TShirt { id: object::new(ctx) }
}

#[lint_allow(share_owned, self_transfer)]
/// Create a kiosk and give owner cap to sender
public fun new_kiosk(ctx: &mut TxContext) {
    let (k, cap) = kiosk::new(ctx);
    transfer::public_share_object(k);
    // transfer::public_transfer(cap, transfer::sender(ctx)); // wrong
    transfer::public_transfer(cap, tx_context::sender(ctx));
}

/// Place an item into the kiosk
public fun place(k: &mut Kiosk, cap: &KioskOwnerCap, item: TShirt) {
    kiosk::place(k, cap, item)
}

/// Withdraw an item from the kiosk
public fun withdraw(k: &mut Kiosk, cap: &KioskOwnerCap, item_id: object::ID): TShirt {
    kiosk::take<TShirt>(k, cap, item_id)
}

/// List an item for sale
public fun list(k: &mut Kiosk, cap: &KioskOwnerCap, item_id: object::ID, price: u64) {
    kiosk::list<TShirt>(k, cap, item_id, price)
}

/// Buy a listed item
public fun buy(k: &mut Kiosk, item_id: object::ID, payment: Coin<SUI>): (TShirt, TransferRequest<TShirt>) {
    kiosk::purchase<TShirt>(k, item_id, payment)
}

/// Confirm a transfer request
public fun confirm_request(policy: &TransferPolicy<TShirt>, req: TransferRequest<TShirt>) {
    transfer_policy::confirm_request<TShirt>(policy, req);
}

#[lint_allow(share_owned, self_transfer)]
/// Create a transfer policy for TShirt
public fun new_policy(publisher: &Publisher, ctx: &mut TxContext) {
    let (p, cap) = transfer_policy::new<TShirt>(publisher, ctx);
    transfer::public_share_object(p);
    // transfer::public_transfer(cap, transfer::sender(ctx)); // wrong
    transfer::public_transfer(cap, tx_context::sender(ctx));
}
`.trim(),

    'sources/fixed_royalty_rule.move': `
/// Fixed royalty rule for Kiosk transfers
module ${pkg}::fixed_royalty_rule;

use sui::coin::Coin;
use sui::sui::SUI;
use sui::transfer_policy::{Self as transfer_policy, TransferPolicy, TransferPolicyCap, TransferRequest};

/// Error codes
const EIncorrectArgument: u64 = 0;
const EInsufficientAmount: u64 = 1;

/// Max value (basis points)
const MAX_BPS: u16 = 10_000;

/// Rule witness
public struct Rule has drop {}

/// Rule configuration
public struct Config has drop, store {
    amount_bp: u16,
    min_amount: u64,
}

/// Add the rule to a transfer policy
public fun add<T>(
    policy: &mut TransferPolicy<T>,
    cap: &TransferPolicyCap<T>,
    amount_bp: u16,
    min_amount: u64,
) {
    assert!(amount_bp <= MAX_BPS, EIncorrectArgument);
    transfer_policy::add_rule(Rule {}, policy, cap, Config { amount_bp, min_amount })
}

/// Pay the royalty fee
public fun pay<T: key + store>(
    policy: &mut TransferPolicy<T>,
    request: &mut TransferRequest<T>,
    payment: Coin<SUI>,
) {
    let paid = transfer_policy::paid(request);
    let amount = fee_amount<T>(policy, paid);
    assert!(payment.value() == amount, EInsufficientAmount);

    transfer_policy::add_to_balance(Rule {}, policy, payment);
    transfer_policy::add_receipt(Rule {}, request)
}

/// Calculate the royalty fee
public fun fee_amount<T: key + store>(policy: &TransferPolicy<T>, paid: u64): u64 {
    let config: &Config = transfer_policy::get_rule(Rule {}, policy);
    let mut amount = (((paid as u128) * (config.amount_bp as u128) / 10_000) as u64);
    if (amount < config.min_amount) { amount = config.min_amount };
    amount
}
`.trim(),

    'sources/dummy_policy.move': `
/// Minimal dummy rule example
module ${pkg}::dummy_rule;

use sui::coin::Coin;
use sui::sui::SUI;
use sui::transfer_policy::{Self as policy, TransferPolicy, TransferPolicyCap, TransferRequest};

/// Rule witness
public struct Rule has drop {}
/// Rule config
public struct Config has drop, store {}

/// Attach the dummy rule to a policy
public fun set<T>(tp: &mut TransferPolicy<T>, cap: &TransferPolicyCap<T>) {
    policy::add_rule(Rule {}, tp, cap, Config {})
}

/// Pay and record receipt
public fun pay<T>(tp: &mut TransferPolicy<T>, req: &mut TransferRequest<T>, payment: Coin<SUI>) {
    policy::add_to_balance(Rule {}, tp, payment);
    policy::add_receipt(Rule {}, req);
}
`.trim(),

    'README.md': README,
  };
}

export const MoveTemplate_Intro_Kiosk: MoveTemplate = {
  id: 'kiosk',
  label: 'Sui Move Intro Course: Kiosk',
  defaultName: 'kiosk',
  description: 'Kiosk and transfer policy',
  detail:
    'Demonstrates TShirt lifecycle with kiosk plus royalty and dummy transfer rules.',
  files,
};

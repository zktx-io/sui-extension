import { FileMap, MoveTemplate, withCommon } from './types';

export const README = withCommon(`
# Flashloan (Sui Move Intro Course)

A simple flashloan pool supporting deposit, borrow/repay within a PTB, and NFT mint/sell.

Source: https://github.com/sui-foundation/sui-move-intro-course/tree/main/unit-five/example_projects/flashloan

## Next steps
1. Inspect \`sources/flashloan.move\` for loan logic.
2. Compile with \`sui move build\`.
3. Deploy with \`sui client publish .\` and test borrowing and repaying in a single PTB.
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

    'sources/flashloan.move': `
// Copyright (c) Sui Foundation, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::flashloan;

// --- Imports ---
// NOTE: Keep problematic aliases as comments to avoid W02021, but show intent.
// use sui::transfer;        // W02021 duplicate alias (provided by default)
// use sui::tx_context;      // W02021 duplicate alias (provided by default)
// use sui::object;          // W02021 duplicate alias (provided by default)

use sui::coin::Coin;
use sui::sui::SUI;
use sui::balance;            // ok to import the module for Balance/ops

// === Errors ===

/// For when the loan amount exceeds the pool amount
const ELoanAmountExceedPool: u64 = 0;
/// For when the repay amount does not match the initial loan amount
const ERepayAmountInvalid: u64 = 1;

// === Structs ===

/// A shared loan pool; SUI-only for demo.
/// NOTE: add 'store' so it satisfies transfer::public_share_object<T: key + store>
public struct LoanPool has key, store {
    id: UID,
    amount: balance::Balance<SUI>,
}

/// A loan position; "hot potato" that must be repaid before tx ends.
public struct Loan {
    amount: u64,
}

/// A dummy NFT to represent the flashloan functionality
public struct NFT has key {
    id: UID,
    price: balance::Balance<SUI>,
}

fun init(ctx: &mut TxContext) {
    let pool = LoanPool {
        id: object::new(ctx),
        amount: balance::zero(),
    };
    // transfer::share_object(pool); // older API
    transfer::public_share_object(pool);
}

// === Public-Mutative Functions ===

/// Deposit SUI into the loan pool
public fun deposit_pool(pool: &mut LoanPool, deposit: Coin<SUI>) {
    // pool.amount.join(coin::into_balance(deposit)); // 'coin' unresolved
    pool.amount.join(sui::coin::into_balance(deposit));
}

/// Borrow from the loan pool and get (Coin<SUI>, Loan) which must be repaid in-PTB.
public fun borrow(
    pool: &mut LoanPool,
    amount: u64,
    ctx: &mut TxContext,
): (Coin<SUI>, Loan) {
    assert!(amount <= pool.amount.value(), ELoanAmountExceedPool);
    (
        // balance::into_coin(pool.amount.split(amount), ctx); // unbound in balance
        sui::coin::from_balance(pool.amount.split(amount), ctx),
        Loan { amount },
    )
}

/// Repay the loan (must be called before the transaction ends).
public fun repay(pool: &mut LoanPool, loan: Loan, payment: Coin<SUI>) {
    let Loan { amount } = loan;
    // assert!(coin::value(&payment) == amount, ERepayAmountInvalid); // 'coin' unresolved
    assert!(sui::coin::value(&payment) == amount, ERepayAmountInvalid);

    // pool.amount.join(coin::into_balance(payment)); // 'coin' unresolved
    pool.amount.join(sui::coin::into_balance(payment));
}

/// Mint an NFT by depositing the provided payment into its price field
public fun mint_nft(payment: Coin<SUI>, ctx: &mut TxContext): NFT {
    NFT {
        id: object::new(ctx),
        // price: coin::into_balance(payment), // 'coin' unresolved
        price: sui::coin::into_balance(payment),
    }
}

/// Sell the NFT to receive its SUI back
public fun sell_nft(nft: NFT, ctx: &mut TxContext): Coin<SUI> {
    let NFT { id, price } = nft;
    object::delete(id);
    // balance::into_coin(price, ctx) // unbound in balance
    sui::coin::from_balance(price, ctx)
}
`.trim(),

    'README.md': README,
  };
}

export const MoveTemplate_Intro_Flashloan: MoveTemplate = {
  id: 'flashloan',
  label: 'Sui Move Intro Course: Flashloan',
  defaultName: 'flashloan',
  description: 'Flashloan pool',
  detail:
    'Deposit, borrow, use, and repay SUI in one PTB. Includes simple NFT trade demo.',
  files,
};

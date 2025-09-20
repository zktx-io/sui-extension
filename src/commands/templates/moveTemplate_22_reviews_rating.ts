import { FileMap, MoveTemplate, withCommon } from './types';

const README = withCommon(`
# MystenLabs Example: Reviews & Rating

A reviews/rating system with services, reviews, moderators, proof-of-experience, and reward distribution. Demonstrates:
- Shared dashboards and service registration (dynamic fields)
- Creating/removing reviews with intrinsic/extrinsic scoring and PoE boost
- Moderator capability to remove reviews
- Reward pool distribution to top reviews

Source: https://github.com/MystenLabs/sui/tree/main/examples/move/reviews_rating
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

    'sources/dashboard.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::dashboard;

use std::string::String;
use sui::dynamic_field as df;

/// Dashboard is a collection of services
public struct Dashboard has key, store {
    id: UID,
    service_type: String,
}

/// Create a new dashboard
public fun create_dashboard(service_type: String, ctx: &mut TxContext) {
    let db = Dashboard {
        id: object::new(ctx),
        service_type,
    };
    transfer::share_object(db);
}

public fun register_service(db: &mut Dashboard, service_id: ID) {
    df::add(&mut db.id, service_id, service_id);
}
`.trim(),

    'sources/moderator.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::moderator;

use sui::tx_context::sender;

/// Represents a moderator that can be used to delete reviews
public struct Moderator has key {
    id: UID,
}

/// A capability that can be used to setup moderators
public struct ModCap has key, store {
    id: UID,
}

fun init(ctx: &mut TxContext) {
    let mod_cap = ModCap {
        id: object::new(ctx),
    };
    transfer::transfer(mod_cap, sender(ctx));
}

/// Adds a moderator
public fun add_moderator(_: &ModCap, recipient: address, ctx: &mut TxContext) {
    // generate an NFT and transfer it to moderator who may use it to delete reviews
    let mod = Moderator {
        id: object::new(ctx),
    };
    transfer::transfer(mod, recipient);
}

/// Deletes a moderator
public fun delete_moderator(mod: Moderator) {
    let Moderator { id } = mod;
    object::delete(id);
}
`.trim(),

    'sources/review.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::review;

use std::string::String;
use sui::clock::Clock;

const EInvalidContentLen: u64 = 1;

const MIN_REVIEW_CONTENT_LEN: u64 = 5;
const MAX_REVIEW_CONTENT_LEN: u64 = 1000;

/// Represents a review of a service
public struct Review has key, store {
    id: UID,
    owner: address,
    service_id: ID,
    content: String,
    // intrinsic score
    len: u64,
    // extrinsic score
    votes: u64,
    time_issued: u64,
    // proof of experience
    has_poe: bool,
    // total score
    total_score: u64,
    // overall rating value; max=5
    overall_rate: u8,
}

/// Creates a new review
public(package) fun new_review(
    owner: address,
    service_id: ID,
    content: String,
    has_poe: bool,
    overall_rate: u8,
    clock: &Clock,
    ctx: &mut TxContext,
): Review {
    let len = content.length();
    assert!(len > MIN_REVIEW_CONTENT_LEN && len <= MAX_REVIEW_CONTENT_LEN, EInvalidContentLen);
    let mut new_review = Review {
        id: object::new(ctx),
        owner,
        service_id,
        content,
        len,
        votes: 0,
        time_issued: clock.timestamp_ms(),
        has_poe,
        total_score: 0,
        overall_rate,
    };
    new_review.total_score = new_review.calculate_total_score();
    new_review
}

/// Deletes a review
public(package) fun delete_review(rev: Review) {
    let Review {
        id,
        owner: _,
        service_id: _,
        content: _,
        len: _,
        votes: _,
        time_issued: _,
        has_poe: _,
        total_score: _,
        overall_rate: _,
    } = rev;
    object::delete(id);
}

/// Calculates the total score of a review
fun calculate_total_score(rev: &Review): u64 {
    let mut intrinsic_score: u64 = rev.len;
    intrinsic_score = intrinsic_score.min(150);
    let extrinsic_score: u64 = 10 * rev.votes;
    let vm: u64 = if (rev.has_poe) {
        2
    } else {
        1
    };
    (intrinsic_score + extrinsic_score) * vm
}

/// Updates the total score of a review
fun update_total_score(rev: &mut Review) {
    rev.total_score = rev.calculate_total_score();
}

/// Upvotes a review
public fun upvote(rev: &mut Review) {
    rev.votes = rev.votes + 1;
    rev.update_total_score();
}

public fun get_id(rev: &Review): ID {
    rev.id.to_inner()
}

public fun get_total_score(rev: &Review): u64 {
    rev.total_score
}

public fun get_time_issued(rev: &Review): u64 {
    rev.time_issued
}
`.trim(),

    'sources/service.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::service;

use ${pkg}::moderator::Moderator;
use ${pkg}::review::{Self, Review};
use std::string::String;
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::dynamic_field as df;
use sui::object_table::{Self, ObjectTable};
use sui::sui::SUI;

const EInvalidPermission: u64 = 1;
const ENotEnoughBalance: u64 = 2;
const ENotExists: u64 = 3;

const MAX_REVIEWERS_TO_REWARD: u64 = 10;

/// A capability that can be used to perform admin operations on a service
public struct AdminCap has key, store {
    id: UID,
    service_id: ID,
}

/// Represents a service
public struct Service has key, store {
    id: UID,
    reward_pool: Balance<SUI>,
    reward: u64,
    top_reviews: vector<ID>,
    reviews: ObjectTable<ID, Review>,
    overall_rate: u64,
    name: String,
}

/// Represents a proof of experience that can be used to write a review with higher score
public struct ProofOfExperience has key {
    id: UID,
    service_id: ID,
}

/// Represents a review record
public struct ReviewRecord has drop, store {
    owner: address,
    overall_rate: u8,
    time_issued: u64,
}

#[allow(lint(self_transfer))]
/// Creates a new service
public fun create_service(name: String, ctx: &mut TxContext): ID {
    let id = object::new(ctx);
    let service_id = id.to_inner();
    let service = Service {
        id,
        reward: 1000000,
        reward_pool: balance::zero(),
        reviews: object_table::new(ctx),
        top_reviews: vector[],
        overall_rate: 0,
        name,
    };

    let admin_cap = AdminCap {
        id: object::new(ctx),
        service_id,
    };

    transfer::share_object(service);
    transfer::public_transfer(admin_cap, tx_context::sender(ctx));
    service_id
}

/// Writes a new review
public fun write_new_review(
    service: &mut Service,
    owner: address,
    content: String,
    overall_rate: u8,
    clock: &Clock,
    poe: ProofOfExperience,
    ctx: &mut TxContext,
) {
    assert!(poe.service_id == service.id.to_inner(), EInvalidPermission);
    let ProofOfExperience { id, service_id: _ } = poe;
    object::delete(id);
    let review = review::new_review(
        owner,
        service.id.to_inner(),
        content,
        true,
        overall_rate,
        clock,
        ctx,
    );
    service.add_review(review, owner, overall_rate);
}

/// Writes a new review without proof of experience
public fun write_new_review_without_poe(
    service: &mut Service,
    owner: address,
    content: String,
    overall_rate: u8,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let review = review::new_review(
        owner,
        service.id.to_inner(),
        content,
        false,
        overall_rate,
        clock,
        ctx,
    );
    service.add_review(review, owner, overall_rate);
}

/// Adds a review to the service
fun add_review(service: &mut Service, review: Review, owner: address, overall_rate: u8) {
    let id = review.get_id();
    let total_score = review.get_total_score();
    let time_issued = review.get_time_issued();
    service.reviews.add(id, review);
    service.update_top_reviews(id, total_score);
    df::add(&mut service.id, id, ReviewRecord { owner, overall_rate, time_issued });
    let overall_rate = (overall_rate as u64);
    service.overall_rate = service.overall_rate + overall_rate;
}

/// Returns true if top_reviews should be updated given a total score
fun should_update_top_reviews(service: &Service, total_score: u64): bool {
    let len = service.top_reviews.length();
    len < MAX_REVIEWERS_TO_REWARD
            || total_score > service.get_total_score(service.top_reviews[len - 1])
}

/// Prunes top_reviews if it exceeds MAX_REVIEWERS_TO_REWARD
fun prune_top_reviews(service: &mut Service) {
    while (service.top_reviews.length() > MAX_REVIEWERS_TO_REWARD) {
        service.top_reviews.pop_back();
    };
}

/// Updates top_reviews if necessary
fun update_top_reviews(service: &mut Service, review_id: ID, total_score: u64) {
    if (service.should_update_top_reviews(total_score)) {
        let idx = service.find_idx(total_score);
        service.top_reviews.insert(review_id, idx);
        service.prune_top_reviews();
    };
}

/// Finds the index of a review in top_reviews
fun find_idx(service: &Service, total_score: u64): u64 {
    let mut i = service.top_reviews.length();
    while (0 < i) {
        let review_id = service.top_reviews[i - 1];
        if (service.get_total_score(review_id) > total_score) {
            break
        };
        i = i - 1;
    };
    i
}

/// Gets the total score of a review
fun get_total_score(service: &Service, review_id: ID): u64 {
    service.reviews[review_id].get_total_score()
}

/// Distributes rewards
public fun distribute_reward(cap: &AdminCap, service: &mut Service, ctx: &mut TxContext) {
    assert!(cap.service_id == service.id.to_inner(), EInvalidPermission);
    // distribute a fixed amount to top MAX_REVIEWERS_TO_REWARD reviewers
    let mut len = service.top_reviews.length();
    if (len > MAX_REVIEWERS_TO_REWARD) {
        len = MAX_REVIEWERS_TO_REWARD;
    };
    // check balance
    assert!(service.reward_pool.value() >= (service.reward * len), ENotEnoughBalance);
    let mut i = 0;
    while (i < len) {
        let sub_balance = service.reward_pool.split(service.reward);
        let reward = coin::from_balance(sub_balance, ctx);
        let review_id = &service.top_reviews[i];
        let record = df::borrow<ID, ReviewRecord>(&service.id, *review_id);
        transfer::public_transfer(reward, record.owner);
        i = i + 1;
    };
}

/// Adds coins to reward pool
public fun top_up_reward(service: &mut Service, coin: Coin<SUI>) {
    service.reward_pool.join(coin.into_balance());
}

/// Mints a proof of experience for a customer
public fun generate_proof_of_experience(
    cap: &AdminCap,
    service: &Service,
    recipient: address,
    ctx: &mut TxContext,
) {
    // generate an NFT and transfer it to customer who can use it to write a review with higher score
    assert!(cap.service_id == service.id.to_inner(), EInvalidPermission);
    let poe = ProofOfExperience {
        id: object::new(ctx),
        service_id: cap.service_id,
    };
    transfer::transfer(poe, recipient);
}

/// Removes a review (only moderators can do this)
public fun remove_review(_: &Moderator, service: &mut Service, review_id: ID) {
    assert!(service.reviews.contains(review_id), ENotExists);
    let record: ReviewRecord = df::remove(&mut service.id, review_id);
    service.overall_rate = service.overall_rate - (record.overall_rate as u64);
    let (contains, i) = service.top_reviews.index_of(&review_id);
    if (contains) {
        service.top_reviews.remove(i);
    };
    service.reviews.remove(review_id).delete_review();
}

/// Reorder top_reviews after a review is updated
fun reorder(service: &mut Service, review_id: ID, total_score: u64) {
    let (contains, idx) = service.top_reviews.index_of(&review_id);
    if (!contains) {
        service.update_top_reviews(review_id, total_score);
    } else {
        // remove existing review from vector and insert back
        service.top_reviews.remove(idx);
        let idx = service.find_idx(total_score);
        service.top_reviews.insert(review_id, idx);
    }
}

/// Upvotes a review
public fun upvote(service: &mut Service, review_id: ID) {
    let review = &mut service.reviews[review_id];
    review.upvote();
    service.reorder(review_id, review.get_total_score());
}
`.trim(),
  };
}

export const MoveTemplate_Mysten_ReviewsRating: MoveTemplate = {
  id: 'mysten_reviews_rating',
  label: 'MystenLabs: Reviews & Rating',
  defaultName: 'reviews_rating',
  description: 'Reviews and ratings',
  detail:
    'Service reviews with moderator delete, PoE minting, and reward distribution.',
  files,
};

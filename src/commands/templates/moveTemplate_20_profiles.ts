import { FileMap, MoveTemplate, withCommon } from './types';

const README = withCommon(`
# MystenLabs Example: Profiles

Deterministic, derived user profiles backed by a shared registry. Demonstrates:
- Creating a shared \`ProfilesRegistry\`
- Deriving per-user \`Profile\` objects with predictable IDs (via \`derived_object\`)
- Username validation and owner-only updates
- Receiving objects into a profile (via \`transfer::public_receive\`)

Source: https://github.com/MystenLabs/sui/tree/main/examples/move/profiles
`);

const moveToml = (pkg: string) =>
  `
[package]
name = "${pkg}"
edition = "2024.beta"

[dependencies]

[addresses]
${pkg} = "0x0"
`.trim();

function files(pkg: string): FileMap {
  return {
    'Move.toml': moveToml(pkg),

    'sources/profiles.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// A module that demonstrates derived objects using Sui's derived_object framework.
/// It creates a shared registry where anyone can create deterministic derived profile objects.
module ${pkg}::profiles;

use std::string::String;
use sui::derived_object;
use sui::transfer::Receiving;

/// Error codes
#[error(code = 0)]
const EUsernameEmpty: vector<u8> = b"Username cannot be empty";
#[error(code = 1)]
const EUsernameTooLong: vector<u8> = b"Username cannot be longer than 50 characters";
#[error(code = 2)]
const ENotOwner: vector<u8> = b"Only the owner can update their username";

/// Maximum username length
const MAX_USERNAME_LENGTH: u64 = 50;

/// Shared registry object that anyone can use to create derived user objects
public struct ProfilesRegistry has key {
    id: UID,
    /// Counter for tracking total users created
    total_users: u64,
}

/// User profile object with username - derived from the registry using derived_object
/// This is owned by the user who created it and has a deterministic address
public struct Profile has key {
    id: UID,
    /// The username for this user
    username: String,
    /// The address of the user who owns this profile
    owner: address,
}

/// Initialize the module by creating a shared registry
fun init(ctx: &mut TxContext) {
    let registry = ProfilesRegistry {
        id: object::new(ctx),
        total_users: 0,
    };

    // Share the registry so anyone can use it to create their profiles.
    transfer::share_object(registry);
}

/// Create a new user profile derived from the shared registry using the sender's address as the key
/// This ensures each address can only have one profile per registry
/// The derived object will have a deterministic address based on the registry UID and sender address
/// Returns the created profile for the caller to handle in their programmable transaction block
public fun new_profile(
    registry: &mut ProfilesRegistry,
    username: String,
    ctx: &mut TxContext,
): Profile {
    validate_username!(username);

    let sender = ctx.sender();

    // Claim a derived UID using the sender's address as the key
    // This ensures deterministic addresses and prevents duplicate profiles per address.
    // You can now always figure out the Object ID of the profile, based on the user's
    // address & the registry's ID.
    let derived_id = derived_object::claim(&mut registry.id, sender);

    // Increment user counter
    registry.total_users = registry.total_users + 1;

    // Create the derived user profile object
    let user_profile = Profile {
        id: derived_id,
        username,
        owner: sender,
    };

    // Return the profile for the caller to handle in their programmable transaction block
    user_profile
}

/// Share the profile to make it accessible by anyone!
public fun share(profile: Profile) {
    transfer::share_object(profile);
}

/// Set/update the username of a user profile
/// Only the owner can update their username
public fun set_username(profile: &mut Profile, new_username: String, ctx: &TxContext) {
    // Only the owner can update their username
    assert!(profile.owner == ctx.sender(), ENotOwner);

    // Validate new username
    validate_username!(new_username);

    profile.username = new_username;
}

/// Get the username in human-readable string format
public fun username(profile: &Profile): String {
    profile.username
}

/// Get the owner address of a user profile
public fun owner(profile: &Profile): address {
    profile.owner
}

/// Get the total number of users created from this registry
public fun total_users(registry: &ProfilesRegistry): u64 {
    registry.total_users
}

/// Check if a user profile already exists for a given address in this registry
/// This uses the derived_object exists function to check deterministically
public fun profile_exists(registry: &ProfilesRegistry, user_address: address): bool {
    derived_object::exists(&registry.id, user_address)
}

/// Receive items transferred to the \`Profile\` object as the owner.
public fun receive<T: key + store>(
    profile: &mut Profile,
    object: Receiving<T>,
    ctx: &TxContext,
): T {
    assert!(profile.owner == ctx.sender(), ENotOwner);
    transfer::public_receive(&mut profile.id, object)
}

macro fun validate_username($name: String) {
    let name = $name;
    assert!(!name.is_empty(), EUsernameEmpty);
    assert!(name.length() <= MAX_USERNAME_LENGTH, EUsernameTooLong);
}

#[test_only]
/// Test-only function to create registry for testing
public fun create_registry_for_testing(ctx: &mut TxContext): ProfilesRegistry {
    ProfilesRegistry {
        id: object::new(ctx),
        total_users: 0,
    }
}
`.trim(),

    'tests/profiles_tests.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

#[test_only]
module ${pkg}::profiles_tests;

use ${pkg}::profiles;
use sui::derived_object;
use sui::test_scenario;
use sui::test_utils::destroy;

const ALICE: address = @0xA11CE;
const BOB: address = @0xB0B;

#[test]
fun test_create_user_profile() {
    let mut scenario = test_scenario::begin(ALICE);

    // Create registry
    let mut registry = profiles::create_registry_for_testing(scenario.ctx());

    // Verify profile doesn't exist yet
    assert!(!registry.profile_exists(ALICE));

    // Create user profile
    let profile = registry.new_profile(b"alice_user".to_string(), scenario.ctx());

    // Verify profile data
    assert!(profile.username() == b"alice_user".to_string());
    assert!(profile.owner() == ALICE);

    // Verify registry state
    assert!(registry.total_users() == 1);
    assert!(registry.profile_exists(ALICE));

    // Clean up
    profile.share();
    destroy(registry);
    scenario.end();
}

#[test]
fun test_set_username() {
    let mut scenario = test_scenario::begin(ALICE);

    // Create registry and profile
    let mut registry = profiles::create_registry_for_testing(scenario.ctx());
    let mut profile = registry.new_profile(b"alice_user".to_string(), scenario.ctx());

    // Update username
    profile.set_username(b"alice_updated".to_string(), scenario.ctx());

    // Verify update
    assert!(profiles::username(&profile) == b"alice_updated".to_string());

    // Clean up
    profile.share();
    destroy(registry);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = profiles::ENotOwner)]
fun test_set_username_wrong_owner() {
    let mut scenario = test_scenario::begin(ALICE);

    // Create registry and profile as Alice
    let mut registry = profiles::create_registry_for_testing(scenario.ctx());
    let mut profile = registry.new_profile(b"alice_user".to_string(), scenario.ctx());

    // Switch to Bob and try to update Alice's username (should fail)
    scenario.next_tx(BOB);
    profile.set_username(b"bob_hacker".to_string(), scenario.ctx());

    abort
}

#[test]
#[expected_failure(abort_code = profiles::EUsernameEmpty)]
fun test_empty_username() {
    let mut scenario = test_scenario::begin(ALICE);

    let mut registry = profiles::create_registry_for_testing(scenario.ctx());

    // Try to create profile with empty username (should fail)
    let _profile = registry.new_profile(b"".to_string(), scenario.ctx());

    abort
}

#[test]
#[expected_failure(abort_code = sui::derived_object::EObjectAlreadyExists)]
fun test_duplicate_profile_creation() {
    let mut scenario = test_scenario::begin(ALICE);

    // Create registry
    let mut registry = profiles::create_registry_for_testing(scenario.ctx());

    // Alice creates first profile
    let _profile1 = registry.new_profile(b"alice_user".to_string(), scenario.ctx());

    // Try to create another profile for Alice (should fail due to derived object already exists)
    let _profile2 = registry.new_profile(b"alice_user".to_string(), scenario.ctx());

    abort
}

#[test]
fun test_multiple_users_different_addresses() {
    let mut scenario = test_scenario::begin(ALICE);

    // Create registry
    let mut registry = profiles::create_registry_for_testing(scenario.ctx());

    // Alice creates profile
    let alice_profile = registry.new_profile(b"alice_user".to_string(), scenario.ctx());

    alice_profile.share();
    // Switch to Bob
    scenario.next_tx(BOB);

    let alice_profile_id = derived_object::derive_address(object::id(&registry), ALICE);

    // take Alice (with a known ID)
    let alice_profile = scenario.take_shared_by_id<profiles::Profile>(alice_profile_id.to_id());

    // Bob creates profile
    let bob_profile = registry.new_profile(b"bob_user".to_string(), scenario.ctx());

    // Verify both profiles
    assert!(alice_profile.username() == b"alice_user".to_string());
    assert!(alice_profile.owner() == ALICE);

    assert!(bob_profile.username() == b"bob_user".to_string());
    assert!(bob_profile.owner() == BOB);

    // Verify registry state
    assert!(registry.total_users() == 2);
    assert!(registry.profile_exists(ALICE));
    assert!(registry.profile_exists(BOB));

    test_scenario::return_shared(alice_profile);

    // Clean up
    bob_profile.share();
    destroy(registry);
    scenario.end();
}

#[test]
fun test_derive_profile_address() {
    let mut scenario = test_scenario::begin(ALICE);

    // Create registry
    let mut registry = profiles::create_registry_for_testing(scenario.ctx());

    // Get the predicted address for Alice's profile
    let predicted_address = derived_object::derive_address(object::id(&registry), ALICE);

    // Create Alice's profile
    let profile = registry.new_profile(b"alice_user".to_string(), scenario.ctx());

    // Verify the actual address matches the predicted address
    assert!(object::id_address(&profile) == predicted_address);

    // Clean up
    profile.share();
    destroy(registry);
    scenario.end();
}
`.trim(),

    'README.md': README,
  };
}

export const MoveTemplate_Mysten_Profiles: MoveTemplate = {
  id: 'mysten_profiles',
  label: 'MystenLabs: Profiles',
  defaultName: 'profiles',
  description: 'Derived profiles',
  detail:
    'Shared registry creates per-user profiles with deterministic IDs and updates.',
  files,
};

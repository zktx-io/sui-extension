import { FileMap, MoveTemplate, withCommon } from './types';

const README = withCommon(`
# MystenLabs Example: Soulbound NFT

A simple soulbound NFT example that anyone can mint. It demonstrates:
- Immutable ownership unless a custom \`transfer\` is provided
- Basic metadata fields (name, description, url)
- Event emission on mint

Source: https://github.com/MystenLabs/sui/tree/main/examples/move/nft-soulbound
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

    'sources/testnet_soulbound_nft.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::testnet_soulbound_nft;

use std::string;
use sui::event;
use sui::url::{Self, Url};

/// An example soulbound NFT that can be minted by anybody
///
/// Removing the \`store\` ablity prevents this NFT
/// from being transferred unless this module provides
/// a transfer function.
public struct TestnetSoulboundNFT has key {
    id: UID,
    /// Name for the token
    name: string::String,
    /// Description of the token
    description: string::String,
    /// URL for the token
    url: Url,
    // TODO: allow custom attributes
}

// ===== Events =====

public struct NFTMinted has copy, drop {
    // The Object ID of the NFT
    object_id: ID,
    // The creator of the NFT
    creator: address,
    // The name of the NFT
    name: string::String,
}

// ===== Public view functions =====

/// Get the NFT's \`name\`
public fun name(nft: &TestnetSoulboundNFT): &string::String {
    &nft.name
}

/// Get the NFT's \`description\`
public fun description(nft: &TestnetSoulboundNFT): &string::String {
    &nft.description
}

/// Get the NFT's \`url\`
public fun url(nft: &TestnetSoulboundNFT): &Url {
    &nft.url
}

// ===== Entrypoints =====

#[allow(lint(self_transfer))]
/// Create a new devnet_nft
public fun mint_to_sender(
    name: vector<u8>,
    description: vector<u8>,
    url: vector<u8>,
    ctx: &mut TxContext,
) {
    let sender = ctx.sender();
    let nft = TestnetSoulboundNFT {
        id: object::new(ctx),
        name: string::utf8(name),
        description: string::utf8(description),
        url: url::new_unsafe_from_bytes(url),
    };

    event::emit(NFTMinted {
        object_id: object::id(&nft),
        creator: sender,
        name: nft.name,
    });

    transfer::transfer(nft, sender);
}

/// Transfer \`nft\` to \`recipient\`
/// Do not include this if you want the NFT fully soulbound
public fun transfer(nft: TestnetSoulboundNFT, recipient: address, _: &mut TxContext) {
    // Add custom logic for transferring the NFT
    transfer::transfer(nft, recipient)
}

/// Update the \`description\` of \`nft\` to \`new_description\`
public fun update_description(
    nft: &mut TestnetSoulboundNFT,
    new_description: vector<u8>,
    _: &mut TxContext,
) {
    nft.description = string::utf8(new_description)
}

/// Permanently delete \`nft\`
public fun burn(nft: TestnetSoulboundNFT, _: &mut TxContext) {
    let TestnetSoulboundNFT { id, name: _, description: _, url: _ } = nft;
    id.delete()
}
`.trim(),
  };
}

export const MoveTemplate_Mysten_SoulboundNFT: MoveTemplate = {
  id: 'mysten_nft_soulbound',
  label: 'MystenLabs: Soulbound NFT (testnet)',
  defaultName: 'nft_soulbound',
  description: 'Soulbound NFT',
  detail:
    'Mint with metadata and event. Optional transfer, update, or burn. Testnet only.',
  files,
};

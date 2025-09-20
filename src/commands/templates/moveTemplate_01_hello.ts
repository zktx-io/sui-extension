import { FileMap, MoveTemplate, withCommon } from './types';

export const README = withCommon(`
# Hello World (Sui Move Intro Course)

Official example from the Sui Move Intro Course demonstrating a simple \`HelloWorldObject\` mint.

Source: https://github.com/sui-foundation/sui-move-intro-course/tree/main/unit-one/example_projects/hello_world

## Next steps
1. Open \`sources/hello_world.move\`.
2. Run \`sui move build\` to compile the package.
3. Call the \`mint\` function with \`sui client call\` to mint your first object.
`);

const moveToml = (pkg: string) =>
  `
[package]
name = "${pkg}"
version = "0.0.1"
edition = "2024.beta"

[dependencies]

[addresses]
${pkg} = "0x0"
`.trim();

function files(pkg: string): FileMap {
  return {
    'Move.toml': moveToml(pkg),
    'sources/hello_world.move': `
// Copyright (c) Sui Foundation, Inc.
// SPDX-License-Identifier: Apache-2.0

/// A basic Hello World example for Sui Move, part of the Sui Move intro course:
/// https://github.com/sui-foundation/sui-move-intro-course
///
module ${pkg}::hello_world;

use std::string;

/// An object that contains an arbitrary string
public struct HelloWorldObject has key, store {
    id: UID,
    /// A string contained in the object
    text: string::String,
}

#[lint_allow(self_transfer)]
public fun mint(ctx: &mut TxContext) {
    let object = HelloWorldObject {
        id: object::new(ctx),
        text: b"Hello World!".to_string(),
    };
    transfer::public_transfer(object, ctx.sender());
}
`.trim(),
    'README.md': README,
  };
}

export const MoveTemplate_Intro_HelloWorld: MoveTemplate = {
  id: 'hello_world',
  label: 'Sui Move Intro Course: Hello World',
  defaultName: 'hello_world',
  description: 'Mint a HelloWorldObject',
  detail:
    'Create a minimal object with text "Hello World!". First call uses mint.',
  files,
};

import { FileMap, MoveTemplate, SuiNetwork } from '../moveFiles';

const README = `
# Hello World (Sui Move Intro Course)

Official example from the Sui Move Intro Course.

Source: https://github.com/sui-foundation/sui-move-intro-course/tree/main/unit-one/example_projects/hello_world
`.trim();

const moveToml = (pkg: string, _network: SuiNetwork) =>
  `
[package]
name = "${pkg}"
version = "0.0.1"
edition = "2024.beta"

[dependencies]

[addresses]
${pkg} = "0x0"
`.trim();

function files(pkg: string, network: SuiNetwork): FileMap {
  return {
    'Move.toml': moveToml(pkg, network),
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

export const MoveTemplate_HelloWorld: MoveTemplate = {
  id: 'hello_world',
  title: 'Hello World',
  defaultName: 'hello_world',
  description: 'Basic Hello World object example',
  files,
};

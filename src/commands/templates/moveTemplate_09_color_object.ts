import { FileMap, MoveTemplate, withCommon } from './types';

const README = withCommon(`
# Color Object Example (Mysten Labs)

This package demonstrates a simple object type (\`ColorObject\`) with basic lifecycle operations:

- \`new\`: Create a color object with RGB values
- \`get_color\`: Read the RGB values
- \`copy_into\`: Copy values from one object into another
- \`delete\`: Delete the object
- \`update\`: Update the RGB values

Includes extensive tests for creation, transfer, deletion, and immutability.

Source: https://github.com/MystenLabs/sui/tree/main/examples/move/color_object
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

    'sources/example.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::example;

public struct ColorObject has key, store {
    id: UID,
    red: u8,
    green: u8,
    blue: u8,
}

// === Chapter 1 ===
public fun new(red: u8, green: u8, blue: u8, ctx: &mut TxContext): ColorObject {
    ColorObject { id: object::new(ctx), red, green, blue }
}

public fun get_color(self: &ColorObject): (u8, u8, u8) {
    (self.red, self.green, self.blue)
}

// === Chapter 2 ===
public fun copy_into(from: &ColorObject, into: &mut ColorObject) {
    into.red = from.red;
    into.green = from.green;
    into.blue = from.blue;
}

public fun delete(object: ColorObject) {
    let ColorObject { id, red: _, green: _, blue: _ } = object;
    object::delete(id);
}

// === Chapter 3 ===
public fun update(object: &mut ColorObject, red: u8, green: u8, blue: u8) {
    object.red = red;
    object.green = green;
    object.blue = blue;
}

// === Tests ===
#[test_only]
use sui::test_scenario as ts;

#[test]
fun test_create() {
    let mut ts = ts::begin(@0x0);
    let alice = @0xA;
    let bob = @0xB;

    { ts.next_tx(alice);
      let color = new(255, 0, 255, ts.ctx());
      transfer::public_transfer(color, alice); };

    { ts.next_tx(bob);
      assert!(!ts.has_most_recent_for_sender<ColorObject>(), 0); };

    { ts.next_tx(alice);
      let object: ColorObject = ts.take_from_sender();
      let (red, green, blue) = object.get_color();
      assert!(red == 255 && green == 0 && blue == 255, 0);
      ts.return_to_sender(object); };

    ts.end();
}

#[test]
fun test_copy_into() {
    let mut ts = ts::begin(@0x0);
    let owner = @0xA;

    let (id1, id2) = {
        ts.next_tx(owner);
        let ctx = ts.ctx();
        let c = new(255, 255, 255, ctx);
        transfer::public_transfer(c, owner);
        let id1 = object::id_from_address(ctx.last_created_object_id());

        let c = new(0, 0, 0, ctx);
        transfer::public_transfer(c, owner);
        let id2 = object::id_from_address(ctx.last_created_object_id());
        (id1, id2)
    };

    { ts.next_tx(owner);
      let mut obj1: ColorObject = ts.take_from_sender_by_id(id1);
      let obj2: ColorObject = ts.take_from_sender_by_id(id2);
      obj2.copy_into(&mut obj1);
      ts.return_to_sender(obj1);
      ts.return_to_sender(obj2); };

    { ts.next_tx(owner);
      let obj1: ColorObject = ts.take_from_sender_by_id(id1);
      let (red, green, blue) = obj1.get_color();
      assert!(red == 0 && green == 0 && blue == 0, 0);
      ts.return_to_sender(obj1); };

    ts.end();
}

#[test]
fun test_delete() {
    let mut ts = ts::begin(@0x0);
    let owner = @0xA;

    { ts.next_tx(owner);
      let c = new(255, 0, 255, ts.ctx());
      transfer::public_transfer(c, owner); };

    { ts.next_tx(owner);
      let object: ColorObject = ts.take_from_sender();
      delete(object); };

    { ts.next_tx(owner);
      assert!(!ts.has_most_recent_for_sender<ColorObject>(), 0); };

    ts.end();
}

#[test]
fun test_transfer() {
    let mut ts = ts::begin(@0x0);
    let sender = @0xA;
    let recipient = @0xB;

    { ts.next_tx(sender);
      let c = new(255, 0, 255, ts.ctx());
      transfer::public_transfer(c, sender); };

    { ts.next_tx(sender);
      let object: ColorObject = ts.take_from_sender();
      transfer::public_transfer(object, recipient); };

    { ts.next_tx(sender);
      assert!(!ts.has_most_recent_for_sender<ColorObject>(), 0); };

    { ts.next_tx(recipient);
      assert!(ts.has_most_recent_for_sender<ColorObject>(), 0); };

    ts.end();
}

#[test]
fun test_immutable() {
    let mut ts = ts::begin(@0x0);
    let alice = @0xA;
    let bob = @0xB;

    { ts.next_tx(alice);
      let c = new(255, 0, 255, ts.ctx());
      transfer::public_freeze_object(c); };

    { ts.next_tx(alice);
      assert!(!ts.has_most_recent_for_sender<ColorObject>(), 0); };

    { ts.next_tx(bob);
      let object: ColorObject = ts.take_immutable();
      let (red, green, blue) = object.get_color();
      assert!(red == 255 && green == 0 && blue == 255, 0);
      ts::return_immutable(object); };

    ts.end();
}
`.trim(),
  };
}

export const MoveTemplate_Mysten_ColorObject: MoveTemplate = {
  id: 'mysten_color_object',
  label: 'MystenLabs: Color Object',
  defaultName: 'color_object',
  description: 'RGB object example',
  detail:
    'Create, read, copy, update, delete, and test transfer and immutability.',
  files,
};

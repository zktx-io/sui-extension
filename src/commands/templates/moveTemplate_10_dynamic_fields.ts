import { FileMap, MoveTemplate, withCommon } from './types';

const README = withCommon(`
# Dynamic Fields Example (Mysten Labs)

This package demonstrates how to use **dynamic object fields** in Sui Move.

- \`Parent\` object can hold a dynamic field
- \`Child\` object is added/removed via dynamic fields
- Functions include:
  - \`add_child\`: Add a child object under a parent
  - \`mutate_child\`: Increment a child (direct reference)
  - \`mutate_child_via_parent\`: Increment via parent lookup
  - \`reclaim_child\`: Remove a child back from parent
  - \`delete_child\`: Delete a child

Includes tests for adding, reclaiming, mutating, deleting, and the edge case of deleting a parent with child still attached.

Source: https://github.com/MystenLabs/sui/tree/main/examples/move/dynamic_fields
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

use sui::dynamic_object_field as ofield;

public struct Parent has key {
    id: UID,
}

public struct Child has key, store {
    id: UID,
    count: u64,
}

public fun add_child(parent: &mut Parent, child: Child) {
    ofield::add(&mut parent.id, b"child", child);
}

public fun mutate_child(child: &mut Child) {
    child.count = child.count + 1;
}

public fun mutate_child_via_parent(parent: &mut Parent) {
    mutate_child(ofield::borrow_mut(&mut parent.id, b"child"))
}

public fun reclaim_child(parent: &mut Parent): Child {
    ofield::remove(&mut parent.id, b"child")
}

public fun delete_child(parent: &mut Parent) {
    let Child { id, count: _ } = reclaim_child(parent);
    object::delete(id);
}

// === Tests ===
#[test_only]
use sui::test_scenario;

#[test]
fun test_add_delete() {
    let mut ts = test_scenario::begin(@0xA);
    let ctx = ts.ctx();

    let mut p = Parent { id: object::new(ctx) };
    p.add_child(Child { id: object::new(ctx), count: 0 });

    p.mutate_child_via_parent();
    p.delete_child();

    let Parent { id } = p;
    id.delete();

    ts.end();
}

#[test]
fun test_add_reclaim() {
    let mut ts = test_scenario::begin(@0xA);
    let ctx = ts.ctx();

    let mut p = Parent { id: object::new(ctx) };
    p.add_child(Child { id: object::new(ctx), count: 0 });

    p.mutate_child_via_parent();

    let mut c = p.reclaim_child();
    assert!(c.count == 1, 0);

    c.mutate_child();
    assert!(c.count == 2, 1);

    let Child { id, count: _ } = c;
    id.delete();

    let Parent { id } = p;
    id.delete();

    ts.end();
}

#[test]
fun test_delete_with_child_attached() {
    let mut ts = test_scenario::begin(@0xA);
    let ctx = ts.ctx();

    let mut p = Parent { id: object::new(ctx) };
    p.add_child(Child { id: object::new(ctx), count: 0 });

    let Parent { id } = p;
    id.delete();

    ts.end();
}
`.trim(),
  };
}

export const MoveTemplate_Mysten_DynamicFields: MoveTemplate = {
  id: 'mysten_dynamic_fields',
  label: 'MystenLabs: Dynamic Fields',
  defaultName: 'dynamic_fields',
  description: 'Dynamic fields demo',
  detail:
    'Parent/Child add, remove, mutate, reclaim, and delete with full test coverage.',
  files,
};

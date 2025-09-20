import { FileMap, MoveTemplate, withCommon } from './types';

const README = withCommon(`
# Entry Functions Example (Mysten Labs)

This package demonstrates **entry functions** usage and constraints:

- \`share(bar, ctx)\`: Create & share an object; \`TxContext\` as last param
- \`update(&mut Foo, ctx)\`: Update state using \`ctx.epoch()\`
- \`bar(&Foo) -> u64\`: Entry function returning a droppable value
- \`foo(ctx) -> Foo\`: Non-entry (returns non-droppable value)

Source: https://github.com/MystenLabs/sui/tree/main/examples/move/entry_functions
`);

const moveToml = (pkg: string) =>
  `
[package]
name = "\${pkg}"
version = "0.0.1"
edition = "2024.beta"

[dependencies]

[addresses]
\${pkg} = "0x0"
`
    .trim()
    .replace(/\${pkg}/g, pkg);

function files(pkg: string): FileMap {
  return {
    'Move.toml': moveToml(pkg),
    'README.md': README,

    'sources/example.move': `
// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module ${pkg}::example;

public struct Foo has key {
    id: UID,
    bar: u64,
}

/// Entry functions can accept a reference to the \`TxContext\`
/// (mutable or immutable) as their last parameter.
entry fun share(bar: u64, ctx: &mut TxContext) {
    transfer::share_object(Foo {
        id: object::new(ctx),
        bar,
    })
}

/// Parameters passed to entry functions called in a programmable
/// transaction block (like \`foo\`, below) must be inputs to the
/// transaction block, and not results of previous transactions.
entry fun update(foo: &mut Foo, ctx: &TxContext) {
    foo.bar = ctx.epoch();
}

/// Entry functions can return types that have \`drop\`.
entry fun bar(foo: &Foo): u64 {
    foo.bar
}

/// This function cannot be \`entry\` because it returns a value
/// that does not have \`drop\`.
public fun foo(ctx: &mut TxContext): Foo {
    Foo { id: object::new(ctx), bar: 0 }
}
`.trim(),
  };
}

export const MoveTemplate_Mysten_EntryFunctions: MoveTemplate = {
  id: 'mysten_entry_functions',
  label: 'MystenLabs: Entry Functions',
  defaultName: 'entry_functions',
  description: 'Entry function rules',
  detail:
    'Shows TxContext placement, droppable returns, and a non-entry example.',
  files,
};

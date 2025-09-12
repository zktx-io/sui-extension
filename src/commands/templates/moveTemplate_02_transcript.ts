import { FileMap, MoveTemplate, SuiNetwork } from '../moveFiles';

const README = `
> This template is adapted from the Sui Foundation's intro course (Unit 2).
> Source: https://github.com/sui-foundation/sui-move-intro-course/tree/main/unit-two/example_projects/transcript

This project demonstrates object capabilities (view/update/delete), wrapping/unwrapping, and simple capability gating.
`.trim();

const moveToml = (pkg: string) =>
  `
[package]
name = "${pkg}"
version = "0.0.1"
edition = "2024.beta"

[dependencies]

[addresses]
${pkg} = "0x0"
`.trimStart();

function files(pkg: string, _network: SuiNetwork): FileMap {
  return {
    'Move.toml': moveToml(pkg),
    'README.md': README,

    'sources/transcript.move': `
// Copyright (c) Sui Foundation, Inc.
// SPDX-License-Identifier: Apache-2.0

/// A basic object example for Sui Move, part of the Sui Move intro course:
/// https://github.com/sui-foundation/sui-move-intro-course
module ${pkg}::transcript;

use sui::event;
use sui::object;
use sui::transfer;
use sui::tx_context::{self, TxContext};

public struct WrappableTranscript has key, store {
    id: UID,
    history: u8,
    math: u8,
    literature: u8,
}

public struct Folder has key {
    id: UID,
    transcript: WrappableTranscript,
    intended_address: address,
}

public struct TeacherCap has key { id: UID }

public struct TestStruct has drop, store, copy {}

/// Event marking when a transcript has been requested
public struct TranscriptRequestEvent has copy, drop {
    // The Object ID of the transcript wrapper
    wrapper_id: ID,
    // The requester of the transcript
    requester: address,
    // The intended address of the transcript
    intended_address: address,
}

// Error code for when a non-intended address tries to unpack the transcript wrapper
const ENotIntendedAddress: u64 = 1;

/// Module initializer is called only once on module publish.
fun init(ctx: &mut TxContext) {
    transfer::transfer(TeacherCap { id: object::new(ctx) }, tx_context::sender(ctx))
}

public fun add_additional_teacher(_: &TeacherCap, new_teacher_address: address, ctx: &mut TxContext) {
    transfer::transfer(TeacherCap { id: object::new(ctx) }, new_teacher_address)
}

#[allow(lint(self_transfer))]
public fun create_wrappable_transcript_object(
    _: &TeacherCap,
    history: u8,
    math: u8,
    literature: u8,
    ctx: &mut TxContext,
) {
    let wrappable_transcript = WrappableTranscript { id: object::new(ctx), history, math, literature };
    transfer::public_transfer(wrappable_transcript, tx_context::sender(ctx))
}

// You are allowed to retrieve the score but cannot modify it
public fun view_score(wrappable_transcript: &WrappableTranscript): u8 {
    wrappable_transcript.literature
}

// You are allowed to view and edit the score but not allowed to delete it
public fun update_score(_: &TeacherCap, wrappable_transcript: &mut WrappableTranscript, score: u8) {
    wrappable_transcript.literature = score
}

// You are allowed to do anything with the score, including view, edit, delete the entire transcript itself.
public fun delete_transcript(_: &TeacherCap, transcript_object: WrappableTranscript) {
    let WrappableTranscript { id, .. } = transcript_object;
    id.delete();
}

public fun request_transcript(transcript: WrappableTranscript, intended_address: address, ctx: &mut TxContext) {
    let folder_object = Folder { id: object::new(ctx), transcript, intended_address };
    event::emit(TranscriptRequestEvent {
        wrapper_id: folder_object.id.to_inner(),
        requester: tx_context::sender(ctx),
        intended_address,
    });
    // we transfer the wrapped transcript object directly to the intended address
    transfer::transfer(folder_object, intended_address);
}

#[allow(lint(self_transfer))]
public fun unpack_wrapped_transcript(folder: Folder, ctx: &mut TxContext) {
    // Check that the person unpacking the transcript is the intended viewer
    assert!(folder.intended_address == tx_context::sender(ctx), ENotIntendedAddress);
    let Folder { id, transcript, .. } = folder;
    transfer::transfer(transcript, tx_context::sender(ctx));
    id.delete();
}
`.trimStart(),

    'sources/transcript_1.move_wip': `
// Copyright (c) Sui Foundation, Inc.
// SPDX-License-Identifier: Apache-2.0

/// A basic object example for Sui Move, part of the Sui Move intro course:
/// https://github.com/sui-foundation/sui-move-intro-course
module ${pkg}::transcript;

public struct Transcript { history: u8, math: u8, literature: u8 }

public struct TranscriptObject has key {
    id: UID,
    history: u8,
    math: u8,
    literature: u8,
}

#[allow(lint(self_transfer))]
public fun create_transcript_object(history: u8, math: u8, literature: u8, ctx: &mut TxContext) {
    let transcript_object = TranscriptObject { id: object::new(ctx), history, math, literature };
    transfer::transfer(transcript_object, tx_context::sender(ctx))
}

// You are allowed to retrieve the score but cannot modify it
public fun view_score(transcript_object: &TranscriptObject): u8 {
    transcript_object.literature
}

// You are allowed to view and edit the score but not allowed to delete it
public fun update_score(transcript_object: &mut TranscriptObject, score: u8) {
    transcript_object.literature = score
}

// You are allowed to do anything with the score, including view, edit, delete the entire transcript itself.
public fun delete_transcript(transcript_object: TranscriptObject) {
    let TranscriptObject { id, .. } = transcript_object;
    id.delete();
}
`.trimStart(),

    'sources/transcript_2.move_wip': `
// Copyright (c) Sui Foundation, Inc.
// SPDX-License-Identifier: Apache-2.0

/// A basic object example for Sui Move, part of the Sui Move intro course:
/// https://github.com/sui-foundation/sui-move-intro-course
module ${pkg}::transcript;

public struct WrappableTranscript has key, store {
    id: UID,
    history: u8,
    math: u8,
    literature: u8,
}

public struct Folder has key {
    id: UID,
    transcript: WrappableTranscript,
    intended_address: address,
}

// Error code for when a non-intended address tries to unpack the transcript wrapper
const ENotIntendedAddress: u64 = 1;

#[allow(lint(self_transfer))]
public fun create_wrappable_transcript_object(history: u8, math: u8, literature: u8, ctx: &mut TxContext) {
    let wrappable_transcript = WrappableTranscript { id: object::new(ctx), history, math, literature };
    transfer::transfer(wrappable_transcript, tx_context::sender(ctx));
}

// You are allowed to retrieve the score but cannot modify it
public fun view_score(transcript_object: &WrappableTranscript): u8 {
    transcript_object.literature
}

// You are allowed to view and edit the score but not allowed to delete it
public fun update_score(transcript_object: &mut WrappableTranscript, score: u8) {
    transcript_object.literature = score
}

// You are allowed to do anything with the score, including view, edit, delete the entire transcript itself.
public fun delete_transcript(transcript_object: WrappableTranscript) {
    let WrappableTranscript { id, .. } = transcript_object;
    id.delete();
}

public fun request_transcript(transcript: WrappableTranscript, intended_address: address, ctx: &mut TxContext) {
    let folderObject = Folder { id: object::new(ctx), transcript, intended_address };
    // we transfer the wrapped transcript object directly to the intended address
    transfer::transfer(folderObject, intended_address)
}

#[allow(lint(self_transfer))]
public fun unpack_wrapped_transcript(folder: Folder, ctx: &mut TxContext) {
    // Check that the person unpacking the transcript is the intended viewer
    assert!(folder.intended_address == tx_context::sender(ctx), ENotIntendedAddress);
    let Folder { id, transcript, .. } = folder;
    transfer::transfer(transcript, tx_context::sender(ctx));
    id.delete();
}
`.trimStart(),

    'sources/transcript_3.move_wip': `
// Copyright (c) Sui Foundation, Inc.
// SPDX-License-Identifier: Apache-2.0

/// A basic object example for Sui Move, part of the Sui Move intro course:
/// https://github.com/sui-foundation/sui-move-intro-course
module ${pkg}::transcript;

public struct WrappableTranscript has key, store {
    id: UID,
    history: u8,
    math: u8,
    literature: u8,
}

public struct Folder has key {
    id: UID,
    transcript: WrappableTranscript,
    intended_address: address,
}

public struct TeacherCap has key { id: UID }

// Error code for when a non-intended address tries to unpack the transcript wrapper
const ENotIntendedAddress: u64 = 1;

/// Module initializer is called only once on module publish.
fun init(ctx: &mut TxContext) {
    transfer::transfer(TeacherCap { id: object::new(ctx) }, tx_context::sender(ctx))
}

public fun add_additional_teacher(_: &TeacherCap, new_teacher_address: address, ctx: &mut TxContext) {
    transfer::transfer(TeacherCap { id: object::new(ctx) }, new_teacher_address)
}

#[allow(lint(self_transfer))]
public fun create_wrappable_transcript_object(
    _: &TeacherCap,
    history: u8,
    math: u8,
    literature: u8,
    ctx: &mut TxContext,
) {
    let wrappableTranscript = WrappableTranscript { id: object::new(ctx), history, math, literature };
    transfer::public_transfer(wrappableTranscript, tx_context::sender(ctx))
}

// You are allowed to retrieve the score but cannot modify it
public fun view_score(transcript_object: &WrappableTranscript): u8 {
    transcript_object.literature
}

// You are allowed to view and edit the score but not allowed to delete it
public fun update_score(_: &TeacherCap, transcript_object: &mut WrappableTranscript, score: u8) {
    transcript_object.literature = score
}

// You are allowed to do anything with the score, including view, edit, delete the entire transcript itself.
public fun delete_transcript(_: &TeacherCap, transcript_object: WrappableTranscript) {
    let WrappableTranscript { id, .. } = transcript_object;
    id.delete();
}

public fun request_transcript(transcript: WrappableTranscript, intended_address: address, ctx: &mut TxContext) {
    let folder_object = Folder { id: object::new(ctx), transcript, intended_address };
    // we transfer the wrapped transcript object directly to the intended address
    transfer::transfer(folder_object, intended_address)
}

#[allow(lint(self_transfer))]
public fun unpack_wrapped_transcript(folder: Folder, ctx: &mut TxContext) {
    // Check that the person unpacking the transcript is the intended viewer
    assert!(folder.intended_address == tx_context::sender(ctx), ENotIntendedAddress);
    let Folder { id, transcript, .. } = folder;
    transfer::transfer(transcript, tx_context::sender(ctx));
    id.delete();
}
`.trimStart(),
  };
}

export const MoveTemplate_Transcript: MoveTemplate = {
  id: 'transcript',
  title: 'Transcript (Objects & Wrapping)',
  defaultName: 'transcript',
  description: 'Owned object, capability, wrap/unpack, event',
  files,
};

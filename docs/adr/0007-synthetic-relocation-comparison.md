# ADR 0007: Synthetic relocation comparison

Status: Accepted

Partly replaced by [ADR 0024](0024-real-mission-call-targets.md), which replaces the consequence that real missions keep the linked-word limitation, for calls.

## Context

Exactness compares words outside relocation field masks (see ADR 0003). That alone cannot tell apart references whose only difference lives inside a relocated field. `la $v0,g` and `la $v0,g+4` assemble to identical words and differ only in their relocation addends.

Real targets are linked words, so their relocation information is gone. Synthetic targets are committed, unlinked output of the same toolchain, so they keep complete relocation records.

## Decision

- **What is recorded:** synthetic target fixtures record every relocation in the function. Each record holds its function-relative offset, kind (`HI16`, `LO16`, `GPREL16`, `MIPS26`, or `WORD32`), field mask, field value, and a structured target. The target is either a symbol name with its addend, or a section with an offset. A target is never flattened to a string.
- **How relocations are compared:** for synthetic missions, generated and target relocations are compared by offset. Both sides must have relocations at the same offsets. Each pair must have the same kind and the same target identity: `name` and `addend` for symbol targets, `section` and `offset` for section targets. Display labels are ignored.
- **Result:** a missing, extra, or differing relocation is a `RELOCATION_TARGET` mismatch and makes the result not exact.

## Consequences

- Synthetic missions can teach and verify differences that exist only in relocations.
- A continuous-integration check regenerates every fixture from its OSP-authored solution and requires identical words and relocations, including addends.
- Real missions keep the linked-word limitation described in ADR 0003.

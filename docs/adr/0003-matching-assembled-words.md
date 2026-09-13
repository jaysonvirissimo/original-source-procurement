# ADR 0003: Matching on assembled words

Status: Accepted

## Context

A PlayStation executable contains the words Sony's assembler emits, not the compiler's assembly text. ASPSX rewrites `cc1psx` output: it expands macros, turns `addu $2,$4,5` into `addiu`, and inserts nops for branch delay slots, load delays, multiply and divide gaps, and coprocessor moves. Two assembly listings that differ as text can assemble to identical words. Identical-looking listings can also differ once assembled. A matching game must judge what the executable would contain.

`psyq-wasm` provides the PsyQ 4.4 compiler in the browser. `psyq-asm` reproduces ASPSX 2.77 and 2.81 output word for word, and it reports relocations with the field masks the linker patches, plus per-word provenance for every macro product and inserted nop.

## Decision

- `psyq-wasm` compiles and `psyq-asm` assembles. OSP never parses, expands, encodes, or disassembles assembly itself.
- **Exactness** is decided on one function's assembled words. Word counts must be equal. Every word must be equal outside the bits covered by the generated side's relocation field masks.
- **Masked differences** are reported as field differences and never affect exactness. Real targets are linked words with final addresses in those fields, while assembler output holds zeros there.
- **Target words:** synthetic targets are committed fixtures produced by the same toolchain. Real targets are fetched at runtime (see ADR 0006). Extracting the `dw 0x` values from a fetched upstream `.s` file is data extraction. It is the only text OSP reads from any assembly file.
- **Display:** both sides are shown as decoded instructions. Generated words are annotated from `psyq-asm` provenance.

Without a new record and a regression corpus, OSP does not:

- ignore bits outside relocation fields;
- treat any inserted nop as optional;
- compare compiler assembly text;
- normalize one instruction into another.

## Consequences

- A real target cannot distinguish references that differ only inside a masked field, such as `g` and `g+4`. This is a known limitation of matching against linked words. Synthetic targets avoid it by also comparing relocations (see ADR 0007).
- Alignment and mismatch classification run on decoded instructions, after the exactness decision, and only for teaching.
- If `psyq-asm` fails on compiler output, the game shows a toolchain error, never a player mistake. The case is reduced to OSP-authored source and reported to `psyq-asm`.
- Upgrading `psyq-wasm` or `psyq-asm` requires regenerating synthetic targets and recording any change in emitted words.

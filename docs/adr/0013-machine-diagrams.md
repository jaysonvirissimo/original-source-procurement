# ADR 0013: Machine diagrams

Status: Accepted

## Context

Players new to assembly need to see what a register and an address hold: that `p` holds an address, that memory at that address holds a value, and that a struct field sits at a fixed offset. OSP compares assembled words and never runs code. Diagrams must teach without becoming a simulator and without hiding information from players who cannot see them.

## Decision

- **Static facts from decoded words.** `wordFacts()` in `packages/matching-core` decodes each target word with `psyq-asm` and reports the registers it reads and writes, any load or store with its base, offset, width, and signedness, and which earlier word last wrote that base register. It computes no register or memory values and reads no assembly text.
- **Values come from the mission author.** A synthetic mission may carry an `example`: a plain-language caption, register values at function entry, and memory regions made of labelled cells. A cell may name the region whose address it holds. Schema validation requires that each register and region label appears once, that cells are sorted without overlap, fit their size, and sit at aligned addresses, and that a pointer cell is 4 bytes holding its region's address.
- **Joining facts and values.** The game resolves a load's or store's address from its base register's entry value, or from a pointer cell an earlier load read. It follows the example's data only. An access the example does not lead to is listed in words rather than guessed. A test checks every shipped example against its generated target: every access resolves to a cell of the same width, every region is used, and every register given a value is read before it is written.
- **Presentation.**
  - Diagrams are tables with the caption, never pictures alone, so no information exists only in a visual.
  - They never replace the assembly listing.
  - Scan shows one layer at a time: notes, registers, memory, or stack.
  - A memory diagram also shows under the listing while its skill's help level is `guided` (ADR 0012).
  - The stack layer only says whether the function changes `$sp` until missions teach stack frames.

## Consequences

- Diagrams cannot drift from their targets unnoticed, because shipped examples are checked against generated words.
- Examples illustrate one plausible call. They say nothing about values the real program uses.
- Showing runtime state, stepping through instructions, or computing values would need a new record, because it changes this decision.

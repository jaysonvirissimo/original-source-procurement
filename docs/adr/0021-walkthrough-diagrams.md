# ADR 0021: Walkthrough diagrams

Status: Accepted

## Context

Memory diagrams (ADR 0013) show where values live. Beginners also need to see the order things happen in and what a value looks like as bits. They need to see why the instruction after `jr` runs before the caller resumes, and why only some loads get a nop. They need to see how a signed byte widens to 32 bits, where a pointer argument comes from in the caller, and which operand of `lw` or `sw` is the destination. Prose alone leaves these implicit. A step-through simulator would contradict the decision that OSP never executes code.

## Decision

- **Typed mission data.** A synthetic mission may carry `walkthroughs`, a list of static diagrams. Each has a plain-language caption and may name a skill. There are five kinds:
  - `trace`: numbered steps, each optionally tied to a range of target words.
  - `timeline`: named lanes of such steps, for comparing sequences, such as a branch delay nop with a load delay nop.
  - `bits`: rows of 8, 16, or 32 bits. A row may derive from an earlier row by a left shift, sign extension, or zero extension.
  - `caller`: OSP-authored caller C and a table of example values before and after the call.
  - `operands`: one target word whose operands the game labels.
- **Validation, not execution.**
  - Schema validation checks the following:
    - steps and labeled words stay inside the target;
    - lane and caller row names do not repeat;
    - bit values fit their width;
    - a derived bit row equals the stated operation applied to its source row.

    The last check is arithmetic on authored values. No target word runs.

  - A test checks every shipped walkthrough against its generated target and the mission's `example`:
    - every range is inside the target;
    - labeled words access memory;
    - caller rows that name a register or example cell repeat the example's value.
- **Operands come from decoded facts.** The operand table uses `wordFacts()` to name a load's destination, offset, and base, or a store's source, offset, and base. OSP still reads no assembly text.
- **Presentation.**
  - Walkthroughs are tables with captions, never pictures alone.
  - They appear under the listing while their skill's help level shows diagrams, the same rule as memory diagrams (ADR 0012).
  - They are always available in a Walkthrough layer of Scan.
  - Example values are labeled illustrative.
- Provenance notes from the assembler are shown with ABI register names (`$v1`, not `$3`), so they match the listing.

## Consequences

- Traces, timelines, and bit diagrams cannot silently disagree with the target, their own arithmetic, or the mission's memory example.
- A walkthrough describes one illustrative call. It says nothing about values the real program uses.
- Stepping through instructions, animating state, or computing register values would still need a new record.

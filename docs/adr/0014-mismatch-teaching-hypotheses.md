# ADR 0014: Mismatch teaching hypotheses

Status: Accepted

## Context

A classified mismatch says what differs between two instructions, such as `lb` against `lbu`. A player who is stuck also needs to know what in their C might cause it. That is a guess about source code. The comparison cannot prove it, and a confident guess can teach the wrong fix or give away the answer. The same risk applies to compiler errors: "parse error before `}'" rarely names the actual mistake.

Some differences also span several instructions. Without dedicated rules they show up as several unrelated base findings. Data reached through `$gp` on one side only is one example. The same instructions in a different order is another.

## Decision

- **Base kinds state only what the words prove.**
  - `BRANCH_CONDITION`: two branches with different mnemonics.
  - `BRANCH_TARGET`: a changed branch displacement or `j` index.
  - `CALL_TARGET`: a changed `jal` index. For unlinked targets it is a differing relocation on a `jal`.
- **Two regrouping passes run after base classification and before hazard nops are linked.**
  - `GP_RELATIVE`: a changed row that reads `$gp` on one side only, plus a neighbouring `lui` on the other side, become one mismatch. The findings from those rows stay in its evidence.
  - `INSTRUCTION_ORDER`: consecutive changed pairs whose words are a permutation of each other become one mismatch. So does a missing run matched with the nearest extra run holding the same words. A nop is never treated as moved.
  - Both passes keep every changed row covered by a mismatch.
- **Hypotheses are a separate layer.**
  - `teachingHypotheses()` in `packages/matching-core` reads a finished `MatchResult` and returns `TeachingHypothesis` values. Each has a kind, a confidence, a message, and the ids of the mismatches it rests on.
  - Rules exist for signedness, integer width, structure field type (a load or store at a nonzero offset from a base other than `$sp` or `$gp`), and one expression shape: the target loads through a register that the player's output copies instead.
  - The other hypothesis kinds are reserved names without rules.
- **Wording.**
  - Every message contains "check", "may", or "likely".
  - A message describes what the instructions do and what the source may contain, never the text to type.
  - A property test checks the wording and that every cited id exists.
- **On demand.**
  - The workspace shows hypotheses only when a player opens a mismatch, under a text label, HYPOTHESIS.
  - Nothing opens automatically, so hypotheses appear at every teaching-support setting, including minimal, without adding help nobody asked for.
- **Compiler guidance follows the same rule.**
  - The compiler's message is always shown verbatim.
  - Recognised messages gain one line of guidance, phrased as something to check.
  - For a parse error the compiler noticed only at the next token, the editor marks the line before it.

## Consequences

- Classification can be trusted as fact and hypotheses read as suggestions; the interface keeps the two apart.
- A new hypothesis rule needs a unit test and must pass the wording property. A rule that cannot be phrased without naming the fix does not belong in this layer.
- Regrouping changes which kinds a comparison reports. Tests lock the passes, and any change to them updates those tests together with the rule.

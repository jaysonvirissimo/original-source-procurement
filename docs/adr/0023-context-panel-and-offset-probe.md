# ADR 0023: Context panel and offset probe

Status: Accepted

## Context

A real mission's function reads and writes fields of types declared in its headers. The workspace gave the player no way to see those declarations except a hint stage that revealed one line span, so choosing a field meant spending hints. Offsets are also hard to derive by hand once a type has padding, embedded structs, or types from other headers. Synthetic layout missions had the same gap: their structs were in the starter, but no view showed where each field landed.

The headers are upstream content, fetched at runtime from pinned commits and verified against recorded hashes (ADR 0006, ADR 0018). Neither the declarations nor numbers derived from them may be committed. OSP does not parse assembly (ADR 0003), and it runs nothing it compiles.

## Decision

- **A Context panel in the reference pane.** Missions that compile against headers, or that name context types, get a Context control. The panel shows the headers of the mission's resolved compilation input, whole and read-only, starting from the starter's includes and following nested includes through the `-I` search path. It fetches nothing of its own, records no hint and no other event, looks the same at every scaffold level, and offers no way to insert text into the editor. When the target or a header failed to load, it shows the upstream error with Retry.
- **Missions name types, never members.** `contextTypes` is an optional list of type names, such as `KCB` or `struct Mixed`. Curriculum validation checks that a synthetic mission declares each one. A real mission's names can only be checked against its fetched headers, so a node test does that from local checkouts.
- **The compiler computes every offset.** The probe runs two builds with the resolved input, and both go through the toolchain service.
  1. The starter is built for its preprocessed output, which `psyq-wasm` returns alongside the object. `BuildOutcome` now carries those bytes.
  2. A small reader lists the members of each named type from that output, following typedefs. It is not a C parser. Bit-fields, function pointers, and members without names mark that type unavailable instead of guessed.
  3. OSP generates source: the starter followed by an `int` array whose initializers are each type's `sizeof`, then each member's offset (`(int)&((T *)0)->member`) and `sizeof`. The null-pointer form works whether or not a header defines `offsetof`.
  4. The generated source is built, and the values are read as little-endian words from the section that holds the array's symbol. This reads data, not assembly text, and nothing is executed.
- **Member names come from the headers, not from mission data.** A list of members in the mission would commit upstream field names for real missions. Reading them from the preprocessed output keeps committed data to type names.
- **View state only.** The table lives in the workspace while the mission is open. It is never recorded, persisted, exported, cached, or written to a report.
- **The player's build goes first.** The probe starts once the toolchain and the input are ready. Compile stops a running probe before the player's build starts, and the probe then starts again. `psyq-wasm` queues builds on its worker, so the restarted probe waits behind the player's build. If the probe fails, the table says offsets are unavailable, with the compiler's messages folded away, and Compile and completion are unaffected.

## Consequences

- A field mission can be solved from the Context panel, the offset table, and the manual, without a hint. Hint stage 5 may still point at a declaration for a player who has not opened Context.
- Opening a mission that names context types runs two extra builds. Stopping a probe that is already compiling restarts the compiler worker, which costs a moment before the player's build runs.
- A header construct the member reader cannot handle makes that type's offsets unavailable rather than wrong. The local-checkout test reports it for shipped real missions.
- ADR 0022's pane now hosts a fifth panel, and the rule that the listing stays uncovered applies to it.
- Synthetic missions no longer need to repeat their header text in hints or walkthroughs just to make it readable, although they still may.

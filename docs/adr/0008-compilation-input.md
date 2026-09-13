# ADR 0008: Compilation input

Status: Accepted

## Context

Compiling a mission needs the player's source plus complete context: compiler flags, `-G` size, assembler version, source encoding, and every header the source includes. For real missions, those headers come from upstream at runtime and can fail to load. If the compiler service also loaded files, it would mix I/O with a pure build step. Tests would then need the network, and a missing header could silently produce misleading output.

## Decision

The toolchain service and the context resolver have separate jobs.

**`ToolchainService.build(input, signal)`** takes a fully resolved `CompilationInput`:

- filename and source;
- a map of complete virtual headers;
- `cppFlags` and `rawFlags`;
- `gpSize` (0 or 8);
- `aspsxVersion` (`"2.77"` or `"2.81"`);
- `encoding`.

It does no I/O and knows nothing about missions. It compiles with `psyq-wasm`, then assembles with `psyq-asm` using the same `gpSize` and `aspsxVersion`. The outcome is success, compiler failure, assembler failure, cancelled, timeout, or infrastructure failure. The app creates one compiler instance per session and reuses it.

**`MissionContextResolver.resolve(mission, source, signal)`** produces that input:

1. It copies the compiler settings from the mission.
2. It starts the header map from the mission's authored headers.
3. It loads every remote header as a whole file, in parallel, through the upstream service.
4. If any remote header fails, it returns that failure with the header's path. It never returns a partial map and never starts a build.

The resolver does not discover includes. Real missions record a closed header set, and validation rejects a key that appears in both the authored and remote header maps.

**`cppFlags`** passes to `psyq-wasm` unchanged. A caller-supplied list replaces `psyq-wasm`'s default preprocessor flags, so mission data stores the complete list, starting with those defaults. Neither service adds flags.

## Consequences

- The compiler factory, assembler function, and upstream service are constructor arguments. Tests can inject a failing assembler or a stub upstream service, and development scripts can load headers from local checkouts.
- A mission enables Compile only after resolution succeeds. The resolved input is reused for every compile of that mission; only the source changes.
- A header missing from a recorded set surfaces as ordinary compiler diagnostics, not as a crash.

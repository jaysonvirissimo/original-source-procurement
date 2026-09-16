# ADR 0017: Real-mission pointer corpus

Status: Accepted

## Context

Real missions are built from functions in two upstream repositories that OSP never copies from: it commits pointers — commits, paths, symbols, and hashes — and fetches the content at run time. Producing those pointers by hand does not scale past the one written for the real-function proof, and a pointer is only worth shipping once its known upstream source, compiled with the flags and headers the pointer records, reproduces the target words exactly.

That proof needs the compiler, which lives in the game. The tool that reads the checkouts may not depend on the game. A corpus entry also needs text no tool can write: a title, a briefing, a starter stub, and a hint ladder.

## Decision

- **The importer never compiles.** `tools/mgs-importer` reads pinned checkouts through `git`, resolves each source file's include closure, pins each solved function's target to the commit before its assembly file was removed, hashes everything, and scores a static difficulty profile from the decoded target words. It is pure and deterministic: the same checkouts always produce the same index.
- **The proof lives beside the compiler.** `apps/game/build/verify-corpus.ts` reruns the real-function proof over every pinned candidate, reusing the toolchain service, the mission context resolver, and the local-checkout upstream service the proof already uses. It builds one source file at a time, because the compilation unit is the file, and the assembled object is also what decides which file defines a function — no text search guesses at it.
- **Three commands, two working files, one generated module.** `pnpm corpus:import` writes a candidate index and a review report, `pnpm corpus:verify` writes the reproduction verdicts, and `pnpm corpus:write` merges the reviewed overrides into a generated `packages/curriculum/src/real/corpus.ts`. The index, the verdicts, and the report are working files in an ignored directory; only the generated corpus and the overrides are committed.
- **Reviewed overrides supply the authored half.** `tools/mgs-importer/overrides/real-missions.json` holds the title, phase, briefing, starter source, hints, and skills a maintainer wrote for one function, keyed by its upstream symbol. A reviewed mission whose candidate has gone, or whose function no longer reproduces its target, fails the build rather than disappearing from the corpus.
- **A closed include set, not a minimal one.** The closure is resolved by scanning `#include` directives without evaluating conditions, so it is a superset of what one build reads. That is what a mission needs: every header it could reach is listed, and the reproduction sweep proves the set compiles and matches.
- **Only upstream's default build.** Sources built with the older toolchain are excluded by directory, and a source only the VR disc links is excluded by reading the guards in upstream's linker command template. A function two built source files define is recorded as ambiguous and never shipped: a pointer records a symbol, and nothing in it would say which definition a mission means.

## Consequences

- The importer can run in CI only as far as its unit tests: producing or verifying a corpus needs local clones, named by `OSP_MGS_REVERSING_DIR` and `OSP_PSYQ_SDK_DIR`.
- Repinning the corpus to a newer upstream revision is a reviewed step. `pnpm corpus:update` reports what would change and which shipped pointers no longer resolve; it rewrites nothing.
- Curriculum validation checks the corpus as a whole: every context header and revealed file names the revision the corpus was imported from, every target is pinned to its own earlier commit, and no two missions point at one function.
- The upstream-content audit needs no new rule. It already fingerprints every mission's remote references, and corpus missions are shipped missions.

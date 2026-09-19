# Contributing to OSP

## Setup

```sh
corepack enable
pnpm install
pnpm --filter @osp/game exec playwright install
```

Use Node.js 24. The exact version is in `.nvmrc` and `.tool-versions`.

## Workflow

The maintainer commits to `main` directly. Outside contributors work on a branch and open a pull
request, whose template carries the same attestation as the commit checklist below.

- Before every commit, run:

  ```sh
  pnpm check
  pnpm test:browser   # after pnpm build, for changes that affect the running game
  ```

- Confirm each item of the attestation below. It is the only record that a change was checked for
  upstream content, so make it per commit rather than once per batch of work.
- Keep changes narrow. Avoid unrelated refactors and mass reformatting.
- Commit only when asked to.

### Upstream content attestation

Confirm, for every file the commit changes:

- No content was copied, adapted, or transformed from `mgs_reversing` or `psyq_sdk` into it. That
  covers mission data, hints, manual entries, teaching text, source, tests, fixtures, mocks,
  snapshots, screenshots, reports, and generated or build output.
- Transformed content counts: decoded word arrays, disassembly listings, excerpts, translations into
  pseudocode or another language, reformatting, renaming, and text an AI rewrote from an original.
- Real missions carry pointers and hashes only. Their content is fetched at runtime.
- `pnpm audit:upstream` passes. It catches target files, target word runs, and whole upstream files,
  but it cannot see an excerpt or a rewrite. Those are what this attestation is for.

## Writing commits, comments, and documentation

Committed text must stand on its own. State the rule, behavior, or reason directly instead of pointing to documents that live outside the repository.

## Tests

- Maintained TypeScript keeps at least 99% statement, branch, function, and line coverage. Every coverage exclusion needs a comment in the Vitest config.
- Test behavior, not just types. A green build is not enough.
- A bug fix normally includes a regression test.
- Browser tests run in Chromium, Firefox, and WebKit against the production build served under a sub-path.
- Field-mission browser tests run against a separate `fixtures` build, which adds an OSP-authored field mission, and answer the upstream hosts with that mission's content. Change `apps/game/src/test/fieldFixture.ts` only together with the words its source compiles to; a Node test checks them.
- Test output such as coverage, Playwright reports, traces, and HAR recordings is never committed.

## Package boundaries

| Package                   | May depend on                                          | Must not                                                                             |
| ------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `apps/game`               | every package, `psyq-wasm`, `psyq-asm`                 | put comparison, alignment, or classification logic in React components               |
| `packages/mission-schema` | nothing in the workspace                               | import React, `psyq-wasm`, or `psyq-asm`                                             |
| `packages/matching-core`  | `psyq-asm`, and `mission-schema` for shared primitives | import React or `psyq-wasm`, parse assembly text, use browser storage or the network |
| `packages/curriculum`     | `mission-schema`                                       | import the game or the toolchain packages, or contain any upstream content           |
| `tools/mgs-importer`      | `mission-schema`, `matching-core`, `psyq-asm`          | run in the browser, or write upstream content to committed files                     |

ESLint enforces the import rules, and the storage and network rules for `matching-core`, whether a global is reached bare or through `window`, `globalThis`, or `self`. Changing a boundary, or adding a package, needs an architecture decision record.

In `apps/game`, only `src/features/persistence` uses `indexedDB`, `localStorage`, or `sessionStorage`. Everything else reaches saved progress through the persistence contexts, and ESLint enforces this too. Shipped game code never imports from a `test/` directory; fakes and fixtures are for tests, and only `main.tsx` may load the fixture catalog, behind the fixtures build mode. Build scripts and browser tests may use the game's services but not React.

Mission and skill behavior comes from validated curriculum data, never from rules hard-coded in UI components.

## Curriculum data

`pnpm curriculum:validate` checks every skill, mission, and manual entry against its schema, then checks the rules that span documents. It runs as part of `pnpm check`. Among other things, it rejects:

- a skill or mission that references an unknown skill, or a prerequisite cycle;
- a mission that teaches more than one skill without a `teachesOverride` reason, or a synthesis mission that teaches any skill;
- a mission on the default path that needs a skill no earlier mission on the path teaches;
- a real mission with inline target words, authored headers, a solution, or compiler input that differs from upstream's default build;
- a synthetic mission whose `solution` or words do not match their recorded hashes;
- a mission annotation that points past its target's words, sits on a mission without an inline target, or links an unknown manual entry;
- a mission `terms` entry that names an unknown manual entry or one outside the GLOSSARY section;
- an annotation, example, or walkthrough tied to a skill the mission neither teaches nor practices;
- an `acknowledge-evidence` mission without an `evidence` prompt, an `evidence` prompt under any other completion rule or on a mission without an inline target, or evidence that points past its target's words;
- a real-partial or live hint that does not say whether it is verified, or a hint on any other mission that does;
- example values on a mission without an inline target, or whose registers or region labels repeat, whose cells overlap or do not fit their size or alignment, or whose pointer cell does not hold the address of a region in the same example;
- walkthroughs on a mission without an inline target, or whose steps or labeled word point past its target's words, whose timeline lanes or caller rows repeat a name, whose bit rows do not fit their width, or whose derived bit row does not follow from an earlier, no-wider row;
- a real-function pointer whose provenance, solution reference, compiler input, or header keys do not follow upstream's default build;
- a pointer corpus whose context headers or revealed files name a revision other than the one it was imported from, whose target is pinned to that same revision rather than to an earlier one, or whose missions point at one upstream function twice.

Prerequisites are the source of truth for progression. The default path is a recommended order that must stay consistent with them.

A synthetic mission's source may `#include` OSP-authored headers. Pass them to `trainingCompiler(filename, headers)`, keyed by the name the source includes. The target generator builds with them, the workspace supplies them to every compile, and the Context panel shows them.

A mission that asks the player to reason about a type's layout lists it in `contextTypes`, by name only, such as `"struct Mixed"` or `"KCB"`. The Context panel then shows a field-offset table computed by the pinned compiler at runtime. Never list members or offsets in mission data: for a real mission they come from upstream headers. Validation checks that a synthetic mission declares each type, and `apps/game/src/features/context/offsetProbe.node.test.ts` measures every shipped real mission's types from local checkouts.

A real mission cannot teach, so its override links glossary entries through `terms` instead. List a term when solving depends on a mechanism the target shows but the listed skills do not name, such as a store that runs in a return delay slot. The Manual panel lists those entries under This mission.

Package sources that `pnpm curriculum:validate` loads run directly on Node.js with type stripping, so relative imports in `mission-schema` and `curriculum` use explicit `.ts` extensions and only erasable TypeScript syntax.

## Toolchain boundaries

- `psyq-wasm` is the compiler. OSP does not implement a C compiler, preprocessor, compiler worker runtime, EUC-JP converter, or compiler timeout layer.
- `psyq-asm` is the assembler. OSP does not parse, expand, encode, or disassemble assembly. If `psyq-asm` mishandles compiler output, reduce the case to OSP-authored C and report it upstream instead of working around it here.
- Exactness is decided on assembled words under relocation masks, never on assembly text.
- Only `apps/game/src/features/compiler` imports `psyq-wasm` or `psyq-asm`. The rest of the game sees `BuildOutcome` values, and ESLint enforces the rule.

### Matching

`packages/matching-core` compares one assembled function with its target and explains the differences. It takes a `psyq-asm` object, a symbol, and target words, and never assembly text.

- A **linked** target is real game code. Its relocated fields hold final addresses, so only bits outside the generated relocation masks decide exactness.
- An **unlinked** target is synthetic output of the same toolchain. Its relocations are also compared by offset, kind, and target, including the addend.
- Alignment and mismatch classification run only after exactness is decided, and only to teach. Their costs and rules are locked by tests; change a test only together with the rule it covers.
- Two passes regroup base findings. Data reached through `$gp` on one side only becomes one `GP_RELATIVE`. The same instructions in a different place become one `INSTRUCTION_ORDER`. Every changed row must still carry a mismatch.
- Teaching hypotheses from `teachingHypotheses()` are suggestions, not findings. Every message says "check", "may", or "likely", cites the mismatches it rests on, and never contains source to type. A property test enforces the wording. The game shows hypotheses only when a player opens a mismatch.
- Guidance for compiler messages follows the same rule: the compiler's message stays verbatim, and guidance is phrased as something to check.

### Compiler artifact distribution

`psyq-wasm`'s compiler and preprocessor artifacts (`cc1psx.wasm`, `cc1psx.js`, `cccp.wasm`, `cccp.js`) are GPL-2.0-only. The build ships them, and the worker modules that load them, byte-for-byte under `vendor/psyq-wasm/<version>/`, never through the bundler. Alongside them it ships `psyq-wasm`'s license texts, `PROVENANCE.md`, `SHA256SUMS`, `build-info.json`, and the release's corresponding-source archive. The archive is downloaded once into an ignored cache and verified against a pinned hash.

`pnpm audit:distribution` checks the built site. It fails if the notices are incomplete, if an artifact, record, or the source archive is missing or has the wrong hash, or if any other file holds a copy of an artifact, modified or not. It runs in `pnpm check`, in CI, and before every Pages upload.

To upgrade `psyq-wasm`, update every pinned value in `apps/game/build/psyq-wasm-release.ts` from the new release. The build fails until the installed package, its `SHA256SUMS`, and its `build-info.json` agree with those pins. It also fails if the package no longer creates its worker the way the build expects.

## Upstream content

OSP never commits or bundles:

- target words or `.s` files from `FoxdieTeam/mgs_reversing`;
- C source or headers from `FoxdieTeam/mgs_reversing`;
- PsyQ SDK headers from `FoxdieTeam/psyq_sdk`;
- any other Konami or Sony material.

Real missions carry pointers and hashes. The game fetches their content at runtime from pinned commits.

The rule applies to every committed or deployed file, not only curriculum data. That includes:

- tests, mocks, fixtures, and snapshots;
- HAR recordings, Playwright traces, and screenshots;
- logs, debugging notes, and reproduction reports;
- generated corpus files and build output.

Transformed content still counts. That covers decoded word arrays, disassembly listings, excerpts, and line-ending conversions. It also covers code that has been renamed, reformatted, reordered, paraphrased, translated into pseudocode or another language, or rewritten by an AI.

- Mocks and fixtures for upstream loading use independently authored content. That means OSP-written C and headers, and word lists generated from OSP-authored source, with hashes computed from that content.
- Tests that need real upstream content load it at runtime, from the network or from local checkouts named in configuration. They are skipped when neither is available, and they write output only to ignored directories.
- Public availability, permissive CORS headers, CDN caching, and runtime fetching do not authorize copying upstream content into a commit. Runtime loading is a content-handling policy, not legal clearance.

Hints, manual entries, and briefings are original teaching text. Write them from the target instructions and the curriculum, never by adapting upstream source.

For a real solved mission:

- only hint stages 5 and 9 show upstream C, as read-only line spans: stage 5 a declaration from a header, stage 9 the function in its source file;
- briefings and hints never quote the target: no register names, instruction mnemonics, or hexadecimal values. They point at the highlighted target rows instead, and `pnpm corpus:write` and curriculum validation reject text that quotes them;
- stages 6 to 8 describe the expression shape, the structure, and the remaining logic in general terms. They never give a code or pseudocode skeleton of the upstream function, which values go into which fields, or the order of statements. Omit them when a function is too small to describe without doing so;
- write the text only from the target listing, the starter, and the curriculum, by someone who has not read the upstream source file or its headers;
- the starter is a signature stub with the includes a player needs, and the starter's includes followed by the stage 9 span must match exactly (checked from local checkouts).

### Checking real functions from local checkouts

`packages/curriculum/src/real/feasibility.ts` points to solved upstream functions with commits, paths, and hashes only. `apps/game/src/features/compiler/realFunction.node.test.ts` checks each one. It reads every pointed file at its pinned commit from local clones, verifies the file against its hash, and resolves the recorded headers. It then builds with the pinned toolchain and requires an exact match. It also checks that:

- changing one token of the solution breaks the match;
- every recorded header is needed;
- PsyQ SDK headers stored with CRLF line endings load with LF line endings.

```bash
OSP_MGS_REVERSING_DIR=/path/to/mgs_reversing \
OSP_PSYQ_SDK_DIR=/path/to/psyq_sdk \
pnpm vitest run apps/game/src/features/compiler/realFunction.node.test.ts
```

Both clones need full git history. Keep them outside this repository. Without both variables the suite is skipped.

### Building the real-mission corpus

Real missions come from a reviewed pointer corpus, produced from the same two clones in three steps. Every step writes its working files to `tmp/reports/corpus/`, which is never committed.

```bash
export OSP_MGS_REVERSING_DIR=/path/to/mgs_reversing
export OSP_PSYQ_SDK_DIR=/path/to/psyq_sdk

pnpm corpus:import   # pointers, include closures, difficulty, review report
pnpm corpus:verify   # builds each source file and checks it reproduces its target
pnpm corpus:write    # merges the reviewed overrides into the generated corpus
```

`pnpm corpus:verify` takes symbols as arguments to check only those functions. It also records the function each call reaches, named by the relocation in the reproduced build, and `pnpm corpus:write` commits those names so a real mission can check the callee of every call (ADR 0024). Run a full `pnpm corpus:verify` before writing: a narrowed run records verdicts for its symbols only.

The corpus also records the `psyq-wasm` and `psyq-asm` versions `pnpm corpus:verify` ran with, and so does the hand-written feasibility pointer. `pnpm curriculum:validate` fails when either differs from the pinned toolchain. A real target cannot be regenerated, so after a toolchain bump the proof that each mission still reproduces is out of date until someone with the two clones reruns `pnpm corpus:verify` and `pnpm corpus:write`.

`packages/curriculum/src/real/corpus.ts` is generated. To add or change a real mission, edit `tools/mgs-importer/overrides/real-missions.json` — the reviewed title, phase, briefing, starter stub, hints, and skills for one upstream symbol — and run `pnpm corpus:write` again. A reviewed mission whose function no longer reproduces its target fails the build instead of quietly leaving the corpus.

`pnpm corpus:update` compares a newly pinned revision against the last import and reports what would change, including shipped pointers that no longer resolve. It rewrites nothing.

Two commands supply the facts an override needs and print them to the terminal only:

```bash
pnpm corpus:spans SYMBOL PATH [SYMBOL PATH ...]   # the function's line span, file hash, and signature
pnpm corpus:decode SYMBOL [SYMBOL ...]            # the pinned target's words as instructions
```

A stage 5 or stage 9 reveal records the span and hash `corpus:spans` prints, so a hint never shows the wrong lines. Hint highlight ranges and the shape description handed to a clean-room author are drawn from the `corpus:decode` listing rather than from upstream C. `corpus:decode` reads the last import's index, so run `pnpm corpus:import` first. With the checkouts set, `tools/mgs-importer/src/spans.upstream.test.ts` checks every recorded stage 9 reveal against `corpus:spans`.

The compiled file sits at the virtual root and stands for its upstream directory. Header keys follow from that:

- a header in the same directory is keyed by its path from that directory, such as `libgv.h`;
- other `mgs_reversing` headers are keyed by their repository path;
- SDK headers are keyed under `psyq/include/`.

### Upstream audit

`pnpm audit:upstream` checks every tracked file and the built site. It fails on:

- an upstream target file, or a `dw 0x` target line;
- a file whose SHA-256 matches a referenced upstream file, as-is or after converting its line endings to LF or CRLF;
- a complete run of a referenced target's words, as numbers in text or as aligned words in binary content.

It runs in `pnpm check` after the build, so it always sees a fresh site; naming a site directory that does not exist is a failure, not a skip. It also runs in CI and before every Pages upload. It cannot detect excerpts or rewritten code; reviewers check those against the attestation.

## Dependencies

Before adding a runtime dependency, answer these questions in the pull request:

1. What specific problem does it solve?
2. Does the platform or an existing dependency already solve it?
3. What does it add to the client payload?
4. Is it maintained?
5. Is its license compatible, and what does distributing it in the built site require (notices, provenance, corresponding source)?
6. Does it create a second way to do something the project already does?

The stack is deliberately fixed. Do not add a state library, CSS framework, UI component framework, second editor, second schema library, second test runner, or any assembler, disassembler, or assembly parser other than `psyq-asm`. Large or competing dependencies need an architecture decision record.

Pin toolchain packages (`psyq-wasm`, `psyq-asm`) to exact versions. Upgrading either one means regenerating synthetic targets and recording any change in emitted words.

A package that more than one manifest declares gets one version in the `catalog` of `pnpm-workspace.yaml`, and the manifests reference it as `catalog:`. Change the version there, once.

pnpm refuses package versions published within its minimum release age. For most packages, pick the newest version outside that window instead of adding a `minimumReleaseAgeExclude` entry. The exception is the pinned versions of `psyq-wasm` and `psyq-asm`, which the project maintainer publishes for this game. Those may be listed in `minimumReleaseAgeExclude`, so a toolchain release can be adopted the day it is published.

## Architecture decision records

Decisions that change a locked choice go in `docs/adr/NNNN-short-title.md`, using the template in [`docs/adr/README.md`](docs/adr/README.md). Each record states its context, decision, and consequences directly. Do not rewrite accepted records to hide history. Supersede them with a new record instead.

## Accessibility, privacy, and copy

- Never make 3D, motion, color, or audio necessary to play. Every control must be usable from the keyboard.
- The decorative 3D layer in `apps/game/src/vr/` receives only presentation state: a phase, a mission tier, whether motion is reduced, and a quality. Never pass it source, target words, or match data, and show every state it reflects in the page as well.
- Mission map rules (recommendation, Resume, missing-skill warnings, and search) live as pure functions in `apps/game/src/features/mission-map/mapModel.ts`. The needed-skills rule is `missionNeeds` in `packages/curriculum`, shared with curriculum validation. A missing skill is a warning; never lock a mission.
- Do not add analytics, telemetry, or any remote submission of player source.
- Write short, concrete product copy. OSP assumes the player is intelligent: no mascots, tutorial chatter, or motivational filler.
- Use only original art and audio.

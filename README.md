# OSP: Original Source Procurement

OSP is a browser programming game about reconstructing lost source code from machine-level evidence. It teaches PlayStation 1 matching decompilation to experienced programmers who have never written C or read MIPS assembly, and it leads them toward real work on [`mgs_reversing`](https://github.com/FoxdieTeam/mgs_reversing).

Players write C, compile it in the browser with the PsyQ 4.4 toolchain, and compare the assembled machine words against a target function until they match exactly.

## Status

Playable and growing. The game ships:

- Forty-one training missions in seven phases (translation, memory, types and layout, arithmetic, memory widths, conditions, and branches), each with a target generated from its solution by the pinned toolchain, staged hints, walkthroughs, and machine diagrams. Loops, functions, and the calling convention are next.
- Four field missions on real solved functions from `mgs_reversing`. The repository holds only pointers and hashes; the game fetches the target, headers, and context at runtime from pinned commits.
- An in-browser toolchain: C compiles with `psyq-wasm` and assembles with `psyq-asm`. The Settings screen runs a toolchain check.
- Matching on assembled words with mismatch classification, teaching hypotheses, and an aligned diff view.
- A mission map with recommendations, an orientation, a searchable manual with a glossary, a context panel with a compiler-verified offset probe, and a docked reference pane.
- Progress, attempt history, editor source, and settings saved in the browser, with export and import.
- A presentation layer that draws the training chamber behind the workspace, with a simple-graphics mode and reduced-motion support.

## Requirements

- Node.js 24 (the exact version is in `.nvmrc` and `.tool-versions`)
- pnpm, enabled through Corepack

## Getting started

```sh
corepack enable
pnpm install
pnpm --filter @osp/game dev
```

## Commands

| Command                       | Purpose                                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @osp/game dev` | Run the game with Vite's development server                                                                             |
| `pnpm format`                 | Format every file with Prettier                                                                                         |
| `pnpm format:check`           | Verify formatting                                                                                                       |
| `pnpm lint`                   | ESLint with type-aware TypeScript rules and package-boundary checks                                                     |
| `pnpm typecheck`              | Strict TypeScript across the workspace                                                                                  |
| `pnpm test`                   | Unit tests with Vitest                                                                                                  |
| `pnpm test:coverage`          | Unit tests with the 99% coverage gate                                                                                   |
| `pnpm build`                  | Production build of the game into `apps/game/dist`                                                                      |
| `pnpm test:browser`           | Playwright tests in Chromium, Firefox, and WebKit against the build                                                     |
| `pnpm curriculum:validate`    | Validate skills, missions, manual entries, generated targets, and the default path                                      |
| `pnpm curriculum:targets`     | Regenerate the training missions' targets from their solutions with the pinned toolchain                                |
| `pnpm corpus:import`          | Build the real-mission pointer corpus from local upstream checkouts (see CONTRIBUTING)                                  |
| `pnpm corpus:verify`          | Rebuild each imported function locally and write verdicts and a review report                                           |
| `pnpm corpus:write`           | Write the reviewed corpus into the curriculum package                                                                   |
| `pnpm corpus:update`          | Report what a newly pinned upstream revision would change, without writing                                              |
| `pnpm audit:distribution`     | Check that the built site may distribute the GPL-2.0-only compiler artifacts                                            |
| `pnpm audit:upstream`         | Check tracked files and the built site for upstream content                                                             |
| `pnpm check`                  | The merge gate: format, lint, typecheck, coverage, curriculum validation, build, distribution audit, and upstream audit |

Browser tests serve the production build under a sub-path, the way GitHub Pages serves a project site. Before running them locally, run `pnpm build` and install the browsers once with `pnpm --filter @osp/game exec playwright install`.

## Repository layout

```text
apps/game/                React + Vite game: routing, UI, application services
packages/mission-schema/  Mission and skill schemas; the lowest-level package
packages/matching-core/   Word comparison, alignment, and mismatch classification
packages/curriculum/      Skills, missions, hints, and generated synthetic targets
tools/mgs-importer/       Node-only tool that builds real-mission pointers
docs/adr/                 Architecture decision records
```

The game may depend on every package. `curriculum` depends only on `mission-schema`. `matching-core` stays free of React, browser storage, and network access. Lint enforces these boundaries; see [CONTRIBUTING.md](CONTRIBUTING.md#package-boundaries).

## Deployment

The game is a static site on GitHub Pages. It uses hash routes (`#/`, `#/mission/<id>`, `#/manual/<entry>`, `#/settings`) and relative asset URLs, so a refresh on any route works without server rewrites. After CI passes on `main`, a workflow rebuilds the site, smoke-tests it under a sub-path, and deploys it.

## Privacy

OSP has no backend, telemetry, or accounts. Source code, attempts, and progress stay in the browser. Training missions make no network requests beyond loading the site. Field missions fetch pinned public files from GitHub, falling back to jsDelivr, without credentials, and verify them against recorded hashes.

## Upstream content policy

OSP never commits or bundles Konami's machine code, content from `FoxdieTeam/mgs_reversing`, or the PsyQ SDK headers in `FoxdieTeam/psyq_sdk`. Neither repository has a license. Real missions carry only pointers and hashes, and the game loads their content at runtime from pinned commits. The rule covers every committed or deployed file, including tests, fixtures, snapshots, screenshots, and reports. It also covers transformed content. Runtime loading is a content-handling policy, not legal clearance. See [CONTRIBUTING.md](CONTRIBUTING.md#upstream-content).

OSP uses only original art and audio. It is not affiliated with Konami.

## Third-party software

Every production build includes `THIRD_PARTY_NOTICES.txt` at the site root. It lists each bundled third-party package with its exact version, license, and full license text. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The compiler and preprocessor artifacts from `psyq-wasm` are GPL-2.0-only. The site ships them unmodified under `vendor/psyq-wasm/<version>/`, with their license texts, provenance records, and the release's corresponding-source archive. The first build on a machine downloads that archive, so it needs network access once.

## License

A license for OSP's own code has not been chosen yet.

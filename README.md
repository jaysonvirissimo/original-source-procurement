# OSP: Original Source Procurement

OSP is a browser programming game about reconstructing lost source code from machine-level evidence. It teaches PlayStation 1 matching decompilation to experienced programmers who have never written C or read MIPS assembly, and it leads them toward real work on [`mgs_reversing`](https://github.com/FoxdieTeam/mgs_reversing).

Players write C, compile it in the browser with the PsyQ 4.4 toolchain, and compare the assembled machine words against a target function until they match exactly.

## Status

Early foundation. The repository contains the workspace, tooling, deployment pipeline, and a branded application shell. Missions, compiler integration, and the matching engine are not implemented yet.

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

| Command              | Purpose                                                             |
| -------------------- | ------------------------------------------------------------------- |
| `pnpm format`        | Format every file with Prettier                                     |
| `pnpm format:check`  | Verify formatting                                                   |
| `pnpm lint`          | ESLint with type-aware TypeScript rules and package-boundary checks |
| `pnpm typecheck`     | Strict TypeScript across the workspace                              |
| `pnpm test`          | Unit tests with Vitest                                              |
| `pnpm test:coverage` | Unit tests with the 99% coverage gate                               |
| `pnpm build`         | Production build of the game into `apps/game/dist`                  |
| `pnpm test:browser`  | Playwright tests in Chromium, Firefox, and WebKit against the build |
| `pnpm check`         | The merge gate: format, lint, typecheck, coverage, and build        |

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

OSP has no backend, telemetry, or accounts. Source code, attempts, and progress stay in the browser. Training missions make no network requests beyond loading the site. Real missions will fetch pinned public files from GitHub, falling back to jsDelivr, without credentials.

## Upstream content policy

OSP never commits or bundles Konami's machine code, content from `FoxdieTeam/mgs_reversing`, or the PsyQ SDK headers in `FoxdieTeam/psyq_sdk`. Neither repository has a license. Real missions carry only pointers and hashes, and the game loads their content at runtime from pinned commits. The rule covers every committed or deployed file, including tests, fixtures, snapshots, screenshots, and reports. It also covers transformed content. Runtime loading is a content-handling policy, not legal clearance. See [CONTRIBUTING.md](CONTRIBUTING.md#upstream-content).

OSP uses only original art and audio. It is not affiliated with Konami.

## Third-party software

Every production build includes `THIRD_PARTY_NOTICES.txt` at the site root. It lists each bundled third-party package with its exact version, license, and full license text. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

A license for OSP's own code has not been chosen yet.

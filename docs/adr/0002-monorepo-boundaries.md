# ADR 0002: Monorepo boundaries

Status: Accepted

## Context

OSP combines a browser game, pure matching logic, validated curriculum data, and a Node-only tool that reads upstream checkouts. These parts change for different reasons and run in different environments. If matching or curriculum rules leak into React components, they become hard to test and impossible to reuse from the importer.

## Decision

Use one pnpm monorepo with these projects:

- **`apps/game`** holds the React application:
  - routing, the editor, and the 3D presentation;
  - settings and the persistence adapter;
  - the mission runtime and the toolchain service;
  - the upstream loading service;
  - progress, manual, hint, and history UI;
  - the client-side contribution export.
- **`packages/mission-schema`** is the lowest-level package. It holds Zod schemas and types for skills, missions, targets, hints, predictions, completion, and difficulty. It imports no React and has no runtime dependency on `psyq-asm`.
- **`packages/matching-core`** is pure TypeScript. It extracts a function's words from an assembled object, compares masked words and relocations, aligns instructions, classifies mismatches, and summarizes results. It imports no React, parses no assembly text, and uses neither browser storage nor the network.
- **`packages/curriculum`** holds the skill catalog, synthetic missions, hints, manual metadata, generated synthetic targets, and the real-mission pointer corpus. It depends only on `mission-schema` and never contains upstream content.
- **`tools/mgs-importer`** is a Node-only tool that reads pinned upstream checkouts and writes the pointer corpus. It may use `mission-schema`, `matching-core`, and `psyq-asm`.

Allowed dependency direction:

```text
game          → matching-core, mission-schema, curriculum, psyq-wasm, psyq-asm
curriculum    → mission-schema
matching-core → psyq-asm, and mission-schema only for shared primitives
mgs-importer  → matching-core, mission-schema, psyq-asm
```

Packages export their TypeScript source directly. Vite and Vitest consume it without a separate package build step.

## Consequences

- ESLint's `no-restricted-imports` rules enforce the forbidden imports, so a boundary violation fails the merge gate.
- There are no dependency cycles, and `mission-schema` stays at the bottom.
- Adding a package, or moving responsibility between packages, needs a new record.

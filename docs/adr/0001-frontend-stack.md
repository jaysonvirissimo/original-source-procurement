# ADR 0001: Frontend stack

Status: Accepted

## Context

OSP is a static browser game hosted on GitHub Pages with no backend. Its main screen is a serious programming workspace: a C editor, a compiler running in WebAssembly, and a structured view of assembled machine words. A decorative 3D training-chamber layer sits behind that workspace and must never be required for play.

The project is built across many sessions and by several contributors. A small, fixed set of well-known tools keeps the code consistent and keeps each problem solved in only one way.

## Decision

- **Runtime and packages:** Node.js 24 and pnpm workspaces.
- **Build:** Vite.
- **UI:** React with TypeScript in strict mode, including `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `verbatimModuleSyntax`.
- **Editor:** CodeMirror 6.
- **3D layer:** React Three Fiber and Three.js, for the decorative layer only. The editor and all gameplay UI stay in the DOM.
- **Styling:** CSS Modules over global CSS custom-property design tokens. Components use tokens, never literal colors.
- **Schemas:** Zod.
- **Testing:** Vitest with V8 coverage, fast-check for property tests, and Playwright in Chromium, Firefox, and WebKit.
- **Code quality:** ESLint with type-aware typescript-eslint rules, and Prettier.
- **Fonts:** IBM Plex Mono for code and Barlow Condensed for display, installed from npm and bundled with the site.
- **State:** React local state, reducers, and context for stable services, with no global catch-all context.

The first vertical slice does not add:

- Redux, Zustand, MobX, or another state library;
- Tailwind, styled-components, or a UI component framework;
- a second editor, schema library, or test runner.

## Consequences

- A competing tool in any of these categories needs a new record that names the concrete problem it solves.
- TypeScript is pinned to the 6.0 line. typescript-eslint 8.70 supports TypeScript versions below 6.1, and type-aware linting is part of the merge gate. Revisit the pin when typescript-eslint supports TypeScript 7.
- Fonts are served from the site itself, so the game makes no request to a font CDN. Their licenses appear in the generated third-party notices.
- The app shell implements hash routing with a small in-repository hook instead of a router dependency (see ADR 0005).

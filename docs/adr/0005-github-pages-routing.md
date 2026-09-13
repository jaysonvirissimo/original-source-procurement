# ADR 0005: GitHub Pages routing

Status: Accepted

## Context

GitHub Pages serves static files and cannot rewrite unknown paths to `index.html`. A project site is served from a sub-path named after the repository, such as `/original-source-procurement/`, not from the domain root. A game that uses path-based routes or root-relative asset URLs would break on refresh or fail to load its assets.

## Decision

- **Routes live in the URL hash:**
  - `#/` is the mission map (home);
  - `#/mission/<missionId>`;
  - `#/manual/<entryId>`;
  - `#/settings`;
  - anything else shows a not-found state.
- **Asset URLs:** Vite builds with `base: "./"`, so every asset URL is relative and the build does not depend on the repository name.
- **Router:** a small in-repository hook subscribes to `hashchange` and parses the hash into a typed route. There is no router dependency.
- **Deployment:** GitHub Actions deploys after CI passes on `main`, using the official Pages actions. Before upload, the workflow smoke-tests the production build served under a sub-path.

## Consequences

- Refreshing any route works without server rewrites.
- Browser tests serve the production build only under a sub-path and return 404 at the root. Asset, font, and future WebAssembly or worker URLs that work only at `/` therefore fail in CI instead of in production.
- Deep links carry their state in the hash, which the server never sees.

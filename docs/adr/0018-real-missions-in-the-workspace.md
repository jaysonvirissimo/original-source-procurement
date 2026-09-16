# ADR 0018: Real missions in the workspace

Status: Accepted

## Context

ADR 0006 decides that real missions load their targets, context headers, and hint spans from upstream at runtime, and ADR 0017 ships the reviewed pointers. The workspace could previously compare only inline targets. The upstream cache lives in browser storage, which is opened by the persistence provider. Browser tests block every external host and must never replay recorded upstream responses. A shipped real mission's hashes describe upstream content, so the tests cannot serve content that satisfies them.

## Decision

- **Network service:** `createNetworkUpstream` implements the upstream service over an injected `fetch` and the upstream cache store.
  - Requests go to raw.githubusercontent.com first, then jsDelivr. They follow the limits in ADR 0006: no credentials, a 15-second timeout per host, and a 256 KiB cap that is checked while the body streams.
  - The cache stores the original bytes of verified files. Targets are keyed by `wordsSha256` and C files by `sha256`. A cached entry is used only if it verifies again.
  - URLs are built only from an allowlisted repository, a full lowercase commit, and a safe relative path. Anything else makes no request.
- **Where the service lives:** `UpstreamProvider` sits inside `PersistenceProvider` and builds the service over the loaded storage's cache. Clearing downloaded game data and resetting progress therefore clear what the service reads. When the player plays without saving, the cache is the in-memory one.
- **Loading a mission:** `loadMissionContext` loads an upstream target together with the mission's context headers. The mission becomes ready only when both succeed.
  - A failed target is reported before a failed header, by its path.
  - Until the target loads, the workspace says so and Compile stays disabled.
  - Loading starts when the mission's workspace opens, at its briefing, and never from the mission map.
- **Comparison:** upstream target words come from the linked game, so they are compared as a linked target: relocated fields are masked and relocation targets are not compared (ADR 0003). Inline targets keep their relocation comparison (ADR 0007).
- **Provenance:** field missions show where the function was recovered from: repository, overlay, symbol, and address. The link opens the target file at its pinned commit on GitHub. It never opens the upstream source file, because that file holds the known solution.
- **Browser tests:** a separate Vite build mode, `fixtures`, adds one OSP-authored field mission to the shipped catalog.
  - The build goes to `dist-fixtures`, which is never deployed, and is served on its own port.
  - The spec answers the two content hosts with that mission's header, source, and target text. Every other external request stays blocked.
  - A Node test keeps the fixture's committed words equal to what its source compiles to.
  - Production builds drop the fixture branch.

## Consequences

- Real missions are playable wherever GitHub or jsDelivr is reachable. Training missions never make a request.
- The fixtures build adds a second production build to local browser test runs and to CI.
- Browser tests for field missions run only against the local fixtures build and are skipped against a deployed site.
- Shipped real missions are proven exact only from local checkouts, by a suite that is skipped when none are configured.

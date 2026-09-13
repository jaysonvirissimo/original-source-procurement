# ADR 0004: Persistence

Status: Accepted

## Context

OSP has no accounts and no backend, so player progress lives in the browser. The data includes mission source and attempt history, which can grow large. Real missions also cache content fetched from upstream repositories. That content is not the player's and must never leave the browser in an export.

## Decision

- **Storage:** player state is stored in IndexedDB behind a single persistence adapter. Domain code never touches browser storage APIs directly. `localStorage` may hold only tiny boot preferences.
- **Schemas:** player state is versioned and validated with Zod. Schema changes ship with explicit migrations and migration fixtures.
- **Skills:** player state stores skill-evidence events, not derived skill states. Changing a mastery threshold therefore needs no migration.
- **Source:** current source is saved for every started mission, with debounce rather than on every keystroke.
- **Attempts:** each mission keeps its latest 50 attempts, and pinned attempts are never evicted. Pruning happens only after a save succeeds. No binary compiler artifacts are stored.
- **Player actions:** export, import, and reset are supported. An invalid import never corrupts the existing save.
- **Upstream cache:** content fetched from upstream is cached in a separate IndexedDB object store, keyed by content hash.
  - It is not part of player state.
  - It is never exported or imported.
  - Reset clears it, and so does a separate "clear downloaded game data" setting.
- **Player-authored content:** editor source and attempts are exported exactly as the player wrote them.

## Consequences

- Save exports never contain content OSP fetched from upstream, and OSP never adds fetched content to player state.
- A cache entry is used only while its hash still verifies. A corrupted entry is fetched again.
- Storage failures surface as specific user-facing errors, not generic failures.

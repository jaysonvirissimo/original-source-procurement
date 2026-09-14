# ADR 0011: Save data

Status: Accepted

## Context

ADR 0004 settled that player progress lives in IndexedDB behind one adapter, with versioned schemas, bounded attempt history, and a separate cache for content fetched from upstream. Building it required further decisions: the store layout, how saves stay cheap as history grows, what happens when stored records cannot be read, and when an attempt is recorded.

## Decision

- **Schemas:** the player-state and save-file Zod schemas live in `apps/game/src/features/persistence`, because only the game reads and writes saves. They move to `packages/mission-schema` if a tool ever needs them.
- **Database:** `osp`, version 1, with these stores:
  - `meta`: the version record and settings;
  - `missions`: keyed by mission ID, without attempts;
  - `attempts`: keyed by ID, indexed by mission;
  - `evidence`: keyed by ID, indexed by skill;
  - `upstreamCache`: keyed by SHA-256.

  The database version tracks the store layout only. Record shapes change through the player-state migration registry, which both load and import apply before validation.

- **Saving:** `PersistenceService.save()` takes the whole player state but writes only the records whose objects changed since the last successful save, in one transaction. This relies on progress being updated immutably by a reducer. A failed save leaves the previous save as the comparison base, so the next save writes the change it missed.
  - One save runs at a time. Changes made during a save are written together when it finishes.
  - Source is saved 750 ms after the player stops typing, and at once when the page is hidden or the mission closes.
- **Loading:**
  - A mission, attempt, or evidence record that fails validation is skipped, counted, and left in storage untouched. The player is told how many records were skipped.
  - Invalid settings fall back to defaults.
  - An unreadable version record, or one from a newer version of OSP, stops loading, and OSP does not write to that save. The player can retry or play without saving, which uses in-memory storage for the tab. Only an unreadable save also offers a reset, after confirmation.
- **Attempts:**
  - An attempt is recorded for each build that produced a comparison. Builds that failed, or that defined no function for the mission, are not recorded, because they have no match summary to store.
  - Each mission keeps every pinned attempt and the newest 50 unpinned ones. Pruning happens only after the save containing the new attempt succeeds.
  - Clearing history removes unpinned attempts only.
  - The best match is stored on the mission, so pruning never loses it.
- **Completion:** a completion is identified by the workspace visit and the build that completed it. Recording the same completion twice has no effect. A later visit that completes the mission again records new evidence.
- **Export and import:**
  - A save file is `{ format: "osp-save", schemaVersion, exportedAt, player }`.
  - Export writes the current in-memory progress, including changes not yet written, so it still works when storage is full.
  - Import checks, migrates, and validates the whole file, then replaces all progress in one transaction or changes nothing.
  - Neither export nor import touches `upstreamCache`. Reset clears every store, including `upstreamCache`.
- **Version 1 contents:** settings have no fields yet. Manual unlocks are not stored, because they follow from skill evidence.
- **Storage access:** only `apps/game/src/features/persistence` may use `indexedDB`, `localStorage`, or `sessionStorage`. ESLint enforces this.

## Consequences

- Adding a setting or changing a record shape needs a migration, and a fixture saved by the previous version.
- Skipped records stay in storage until the player resets. An export made after a partial load does not include them.
- History does not list failed builds. The workspace's build feedback shows them instead.

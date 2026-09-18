# ADR 0012: Skill state and fading help

Status: Accepted

Partly replaced by [ADR 0019](0019-completion-evidence-and-modes.md), which replaces the statement that a wrong prediction still completes.

## Context

Saves store skill evidence events: one per skill each time a mission completes, with the highest hint stage opened and whether the solution was revealed (ADR 0011). Teaching help should fade per skill as that evidence grows, without locking missions, and players need a way to keep or remove automatic help. Completion also used to replace the workspace, which hid the comparison and any prediction correction the player had just earned.

## Decision

- **Skill state is derived, never stored.** `skillState()` in `apps/game/src/features/progress` recomputes a skill's state from its evidence, ordered by completion time and then event ID. States are `NEW`, `INTRODUCED`, `PRACTICED`, `DEMONSTRATED`, and `MASTERED`, and never decrease.
  - Any event moves `NEW` to `INTRODUCED`.
  - A `practiced`, `synthesis`, or `real` event with hint stage 6 or lower moves `INTRODUCED` to `PRACTICED`.
  - A `synthesis` or `real` event with hint stage 4 or lower moves `PRACTICED` to `DEMONSTRATED`.
  - A `synthesis` or `real` event with hint stage 3 or lower moves `DEMONSTRATED` to `MASTERED`.
  - An event whose solution was revealed never advances. One event advances a skill one step at most, and a mission advances a given skill once at most, so replays add nothing and mastery always comes from a different mission than demonstration.
  - Prediction results are not skill evidence and never change state.
  - Because nothing derived is stored, changing a threshold needs no save migration.
- **Help levels.** A mission's `scaffold` is the most help it offers. Each skill it teaches or practices gets a level from its state: `guided` for `NEW` and `INTRODUCED`, `assisted` for `PRACTICED`, `independent` for `DEMONSTRATED`, and `field` for `MASTERED`, capped at the mission's `scaffold`. The workspace uses the most helpful of those levels, or the mission's `scaffold` when it lists no skills.
  - `guided` shows note labels, their full explanations, and machine diagrams.
  - `assisted` shows note labels only.
  - `independent` and `field` show nothing automatically.
  - Scan, hints, the manual, mismatch classification, and history stay available at every level. The manual keeps every entry the mission's notes link to, whether or not the notes are shown.
  - A note or diagram tied to a skill follows that skill's level; others follow the workspace's.
- **Frozen per visit.** The help level is chosen when the workspace opens and does not change while it stays open, so evidence recorded on completion never takes notes away mid-mission.
- **Setting.** Settings gain an optional `scaffold` field: `adaptive` (the default, the rules above), `full` (each mission's `scaffold` for every skill), or `minimal` (no automatic notes or diagrams). The field is optional and additive, so it needs no schema version or migration: saves without it stay valid and read as `adaptive`, and an unknown value falls back to defaults as other invalid settings do. This replaces ADR 0011's consequence that adding a setting needs a migration, for optional settings with a default.
- **Completion in place.** Completion shows as a panel above the workspace instead of replacing it. The comparison and any prediction correction stay visible until the player continues. The panel names each recorded skill's state by its learner-facing name, and says when a revealed solution kept skills from advancing. The completion rules in ADR 0009 are unchanged: a wrong prediction still completes a prediction mission.

## Consequences

- Skill state and help selection are pure functions tested with tables, independent of React and storage.
- An older build that loads a save with a `scaffold` setting treats the unknown field as invalid settings and uses its defaults. It does not overwrite them unless the player changes settings there.
- Most first-slice skills stay `INTRODUCED` or `PRACTICED`, because only synthesis and real missions can demonstrate a skill. Missions still lower help through their own `scaffold` until more synthesis missions exist.

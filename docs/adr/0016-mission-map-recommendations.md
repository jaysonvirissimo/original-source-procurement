# ADR 0016: Mission map and recommendations

Status: Accepted

## Context

The home screen listed missions in one flat, numbered list. Players had no view of how training is organized, no suggestion of what to play next, and no warning when a mission expects skills they have not met yet. The curriculum's prerequisites are the source of truth for progression, and mastery must never lock a mission: an experienced player can always skip ahead. Future solved real functions and live functions need a visible place on the map before any exist.

## Decision

- **A 2D map with a list mode.** The home screen shows training missions as lanes, one per curriculum phase, followed by a field region and a live region. Both regions are shown even while they are empty. The map is DOM and CSS, not part of the 3D chamber, so it works the same with simple graphics, with assistive technology, and without WebGL. A list view shows every mission in recommended order with a text search over ID, title, phase, and learner-facing skill names. The player can always switch views.
- **One needed-skills rule.** `missionNeeds` in `packages/curriculum` gives the skills a mission expects already taught: what it requires, what it practices without teaching, and the prerequisites of what it teaches. Curriculum validation uses it to check the default path, and the game uses it for warnings and recommendations.
- **Warnings, never locks.** A mission expects a skill the player has not been introduced to when that skill's state is still `NEW`. The map marks such a mission `SKIPS AHEAD` and names the missing skills, and so does its briefing. Every mission still opens and can be entered.
- **Deterministic recommendation.** The recommended mission is the first incomplete mission, in recommended order, with no missing skills. If there is none, it is the first incomplete mission, and once every mission is complete there is no recommendation. Recommended order is the default path, then the remaining missions. Resume offers the started, incomplete mission whose source was saved most recently, with the earlier mission winning a tie.
- **Rules outside components.** The map model, marks, and search live in `apps/game/src/features/mission-map/mapModel.ts` as pure functions over the catalog and player state. Status is always shown as text, never by color alone.
- **Saved view.** An optional `mapView` setting (`map`, the default, or `list`) remembers the chosen view. As ADR 0012 describes, an optional setting needs no migration. Search text is not saved.

## Consequences

- Changing the recommendation rule, or the thresholds behind skill state, needs no save migration, because both are derived from stored evidence.
- Field and live missions appear in their regions automatically, from their mission kind, when they ship.
- A mission link on the map is named `<id> <TITLE>`. Shortcut links name the title first, so no two links on the map share a name.

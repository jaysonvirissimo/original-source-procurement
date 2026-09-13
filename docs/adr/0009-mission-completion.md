# ADR 0009: Mission completion

Status: Accepted

## Context

Missions complete in three ways:

- by exact match;
- by acknowledging highlighted evidence;
- by recording a prediction before compiling.

Several things can make a naive implementation complete a mission wrongly:

- builds are asynchronous;
- the player can keep editing or switch missions while a build runs;
- a build can succeed without defining the mission's function, for example from an empty file or a renamed function.

## Decision

**Build requests.** Every Compile request gets a `BuildRequest` with the mission ID, a `buildId` that increases through the session, and the SHA-256 of the source sent to the build.

**Mission results.** The workspace turns each build outcome into a mission result bound to its request:

- `matched`: the build succeeded and defined the mission's function. It carries the match result.
- `function-missing`: the build succeeded but defined no function named by the mission's symbol. It carries the expected symbol and the functions that were found. This is recoverable feedback shown near the editor. It is not a toolchain error and not a mismatch, and no diff is shown.
- `build-failed`: the compiler failed, the assembler failed, or the build was cancelled, timed out, or hit an infrastructure failure.

**Current results.** A result is current only when all of these hold:

- its mission is the open mission;
- its `buildId` is the latest Compile request for that mission;
- its source hash equals the hash of the source now in the editor.

A result for an older request or another mission is dropped. Any edit makes the displayed result stale: the diff stays visible with a stale label, and completion is disabled until a new `matched` result is current.

**Completion rules.** Each rule requires a current `matched` result:

- `exact`: the match result is exact.
- `acknowledge-evidence`: the player acknowledged the evidence for that result's `buildId`. An exact match is not required.
- `prediction-recorded`: the player recorded a prediction before the Compile request that produced the result. A wrong prediction still completes. A `build-failed` or `function-missing` result does not use the prediction up.

## Consequences

- Completion is a pure domain function of the mission, the current source hash, the latest mission result, and the player's recorded actions. It lives outside React components and is tested directly.
- Failed, missing-function, cancelled, and timed-out builds never complete a mission.
- Late results can never overwrite newer state.

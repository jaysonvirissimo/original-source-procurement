# ADR 0019: Completion evidence and modes

Status: Accepted

## Context

ADR 0009 completes a demonstration when the player acknowledges the evidence of a current build, and completes a prediction mission once a prediction recorded before the build is revealed, even a wrong one. A walkthrough from the point of view of a web developer new to C and assembly showed that both rules let a player finish without engaging:

- 001 completed with one button, without the player ever identifying the instruction the mission is about.
- 002 completed straight after a wrong prediction. The correction was shown, but nothing asked the player to use it.

The same walkthrough finished the first field mission by revealing its solution. The completion panel noted that skills did not advance, but its only button, Continue, dismissed the panel. The map then said "Training complete", as if every mission had been solved independently. A mission's highest hint stage is saved and restored on every visit, so replaying it still counted as revealed. The player had no way to practice it again for credit.

## Decision

- **Evidence selection.** Missions using `acknowledge-evidence` must carry an `evidence` prompt: a question, a range of target words, and a retry message. The schema rejects `evidence` under any other rule and on a remote target, and requires the range to stay inside the target function. The workspace lists the target words as radio choices. An acknowledgement records the selected word with the `buildId`, and completes only if the word is inside the range. A selection outside the range shows the retry message and records nothing, so the player can choose again.
- **Prediction correction.** A right prediction completes as before. After a wrong prediction is revealed by a current matched build, the player picks the answer the output shows. A wrong pick says so without naming the answer. A right pick records a correction with the `buildId` that revealed it, and completes the mission. A correction counts only if its build is at or after the prediction's build and at or before the current match. It survives recompiling unchanged source. Failed and function-missing builds still use up neither the prediction nor the pending correction.
- **Stored first-try result.** The prediction result saved on completion keeps the first choice and whether it was correct. The correction is not stored separately: every wrong prediction in a new completion was corrected.
- **Completion modes are derived.** One completion's mode is `independent` (no hint opened), `hinted` (hints short of the solution), or `solution-revealed`. It is derived from the skill evidence that completion recorded. Nothing new is stored. The completion panel shows the mode.
- **Actions named for what they do.** Continue becomes Review workspace. The panel also offers Next mission when the training path has one, and Back to map. At the end of the path it says that no mission follows.
- **Practice again.** After a `solution-revealed` completion, Practice again restores the starter source and sets the mission's saved hint stage to 0. Completions, prediction results, attempts, and skill evidence stay. Build numbers keep counting within the visit, so an older result still never applies, and the next completion gets a new ID.
- **Map honesty.** A completed mission whose every completion revealed the solution is marked SOLUTION REVEALED. The map says "Training complete" only when every mission is complete and none is marked that way. Otherwise it says how many were completed with the solution revealed and links the first one to practice.

These rules replace the `acknowledge-evidence` and `prediction-recorded` rules in ADR 0009 and the statement in ADR 0012 that a wrong prediction still completes. The rest of both records stands.

## Consequences

- Completion stays a pure function of the mission, the source hash, the latest result, and recorded actions, now including the selected word and the correction.
- Stored completions are never re-evaluated. Saves made under the earlier rules keep their completed missions, and no save migration is needed: practice uses existing fields, and completion modes are derived.
- A completion that recorded no skill evidence has no mode, and is never marked as revealed on the map.
- Every new demonstration mission must author an evidence prompt, and curriculum validation fails without one.

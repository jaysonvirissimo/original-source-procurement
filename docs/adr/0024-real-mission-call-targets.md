# ADR 0024: Call targets for real missions

Status: Accepted

## Context

A real target is linked words (ADR 0003, ADR 0018). A `jal` in it holds the callee's final address, while the player's object holds zero there with a `MIPS26` relocation naming the callee. Exactness masks that field, so before this record a player whose function called the wrong function still reached an exact match, and the difference was reported only as a field difference. Synthetic targets never had this gap, because their relocations are compared (ADR 0007).

The first real mission whose lesson is a call made that gap a wrong answer marked right. The upstream `.s` files carry words only, with no symbols. Upstream's function inventory (`build/functions.txt`) cannot name every callee either: it leaves out library functions linked from the SDK, such as `ratan2`, and it keeps the original symbol map's names where upstream's source has since renamed file-local functions. A player's build names callees the way the source does.

## Decision

- **The importer records every call.** `RemoteTarget` gains a required `calls` list of `{ word, symbol }`, in word order, empty for a function that calls nothing. Making it required means a pointer cannot leave calls unchecked by omission.
- **The names come from the reproduction.** `corpus:verify` already builds upstream's own source for every candidate. For an exact verdict the words line up one for one, so the relocation on each generated `jal` names that call's callee. psyq-asm relocates a call to a function in the same file against the section and keeps the callee's name as the label, so the label is read there, the one place a label is relied on. The verdict records each call's word, name, and the address the linked word reaches.
- **The corpus writer checks the names before committing them.** Across every exact function in the run, one address must carry one name. A call with no name fails the build. Only word indexes and names are committed, never addresses. Names are already allowed pointer content (ADR 0017).
- **The comparison checks the callee on aligned rows.** For a linked target, each recorded call is compared with the generated call on the same aligned row. A relocated call to a different function, or to nothing nameable, is a `CALL_TARGET` finding, and the result is not exact. A missing or moved call is already reported by the word comparison, as is a generated `jal` without a relocation, whose field is then compared as a plain word.
- **Loading checks that every call is recorded.** When a real mission's words load, the recorded call words must be exactly the words holding a `jal`, or the target is reported as a content mismatch.
- **The Scan view names the callee.** A linked target's recorded calls stand in for the relocations it does not have, so a `jal` row in a real listing reads its callee the way a synthetic one does.

## Consequences

- A real mission can teach a call: the wrong callee is a finding, with the same `CALL_TARGET` kind and wording as in synthetic missions.
- A corpus can no longer be written without a completed `corpus:verify` that recorded calls. The verdict index is at version 2 and the importer at 1.3.0.
- Other masked fields are still not compared for real targets: `HI16`, `LO16`, and `GPREL16` addends (`g` against `g+4`, ADR 0003) and the destination of a linked `j`. The Scan view leaves a linked `j` unresolved rather than claim the comparison checks it.
- The same-address, one-name check would reject a corpus in which two exact functions reach one address by different names. None does at the pinned commit.

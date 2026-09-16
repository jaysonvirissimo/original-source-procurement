# Architecture decision records

Each record captures one architecture decision: the situation that required it, what was decided, and what follows from it. Records stand on their own and do not rely on documents outside the repository.

Changing a locked decision requires a new record. Accepted records are never rewritten to hide history. Mark a replaced record `Superseded` and link to the record that replaces it.

## Index

| Record                                          | Title                           | Status   |
| ----------------------------------------------- | ------------------------------- | -------- |
| [0001](0001-frontend-stack.md)                  | Frontend stack                  | Accepted |
| [0002](0002-monorepo-boundaries.md)             | Monorepo boundaries             | Accepted |
| [0003](0003-matching-assembled-words.md)        | Matching on assembled words     | Accepted |
| [0004](0004-persistence.md)                     | Persistence                     | Accepted |
| [0005](0005-github-pages-routing.md)            | GitHub Pages routing            | Accepted |
| [0006](0006-upstream-runtime-loading.md)        | Upstream runtime loading        | Accepted |
| [0007](0007-synthetic-relocation-comparison.md) | Synthetic relocation comparison | Accepted |
| [0008](0008-compilation-input.md)               | Compilation input               | Accepted |
| [0009](0009-mission-completion.md)              | Mission completion              | Accepted |
| [0010](0010-compiler-artifact-distribution.md)  | Compiler artifact distribution  | Accepted |
| [0011](0011-save-data.md)                       | Save data                       | Accepted |
| [0012](0012-skill-state-and-fading-help.md)     | Skill state and fading help     | Accepted |
| [0013](0013-machine-diagrams.md)                | Machine diagrams                | Accepted |
| [0014](0014-mismatch-teaching-hypotheses.md)    | Mismatch teaching hypotheses    | Accepted |
| [0015](0015-vr-presentation-layer.md)           | VR presentation layer           | Accepted |
| [0016](0016-mission-map-recommendations.md)     | Mission map and recommendations | Accepted |
| [0017](0017-real-mission-pointer-corpus.md)     | Real-mission pointer corpus     | Accepted |
| [0018](0018-real-missions-in-the-workspace.md)  | Real missions in the workspace  | Accepted |
| [0019](0019-completion-evidence-and-modes.md)   | Completion evidence and modes   | Accepted |

## Template

Name new records `NNNN-short-title.md`, numbered sequentially.

```markdown
# ADR NNNN: Title

Status: Proposed | Accepted | Superseded

## Context

## Decision

## Consequences
```

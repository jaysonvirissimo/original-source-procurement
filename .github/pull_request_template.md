## Summary

<!-- What changed, and why. -->

## Checks

- [ ] `pnpm check` passes.
- [ ] `pnpm test:browser` passes, if this change affects the running game.

## Upstream content attestation

- [ ] I confirm that no content from `FoxdieTeam/mgs_reversing`, `FoxdieTeam/psyq_sdk`, or any Konami or Sony material was copied, adapted, or transformed into any file this pull request changes.

This covers every changed file of every type:

- mission data, hints, manual entries, briefings, and other teaching text;
- source code and comments;
- tests, mocks, fixtures, snapshots, HAR recordings, traces, and screenshots;
- logs, debugging notes, and reproduction reports;
- generated corpus files and build artifacts.

It includes target words, `.s` files, decoded word arrays, disassembly listings, excerpts, and line-ending conversions. It also includes upstream code that has been renamed, reformatted, reordered, paraphrased, translated into pseudocode or another language, or rewritten by an AI. Real-mission content is loaded at runtime from pinned upstream commits and is never committed.

# ADR 0006: Upstream runtime loading

Status: Accepted

## Context

Real missions use functions from `FoxdieTeam/mgs_reversing`. Their targets are Konami's machine code, and their context headers and known solutions were written by that project's contributors. Upstream also builds against the PsyQ SDK headers in `FoxdieTeam/psyq_sdk`. Neither repository has a license. OSP needs this content to offer real missions, but it must not redistribute it.

## Decision

- **Pointers only:** real missions carry pointers and hashes, never content. A pointer names an allowlisted repository (`FoxdieTeam/mgs_reversing` or `FoxdieTeam/psyq_sdk`), a 40-character commit, a normalized path, and a SHA-256.
- **Fetching:** the game fetches content at runtime, only when a real mission opens or a hint needs it. It tries `https://raw.githubusercontent.com/<repository>/<commit>/<path>` first, then `https://cdn.jsdelivr.net/gh/<repository>@<commit>/<path>`.
- **Request limits:** each request omits credentials, sends no player data, times out after 15 seconds, and is capped at 256 KiB.
- **Verification:**
  - For targets, the `dw 0x` values are extracted, and the SHA-256 is checked over the words as little-endian 32-bit values.
  - For C files and headers, the SHA-256 is checked over the fetched bytes. Line endings are then converted from CRLF to LF, because the preprocessor does not treat a backslash before CRLF as a line continuation.
  - Content that fails its hash is discarded.
- **Failure:** if no host succeeds, the mission shows a specific upstream-unavailable or content-mismatch state with Retry. There is no fallback to the player's own game files.
- **Caching:** verified content is cached in the browser only (see ADR 0004).

## Consequences

- No committed or deployed file contains upstream content. The rule covers:
  - tests, mocks, fixtures, and snapshots;
  - recordings, traces, and screenshots;
  - reports, generated corpus files, and build output;
  - transformed content, such as decoded words, excerpts, line-ending conversions, and renamed, paraphrased, or AI-rewritten code.
- Mocks for upstream loading serve OSP-authored content with hashes computed from that content.
- An automated audit detects whole upstream files, their line-ending variants, target-word lines, and complete target word runs. A pull request attestation and maintainer review cover what the audit cannot detect.
- If upstream becomes unavailable, real missions stop working, while training missions are unaffected.
- Runtime loading is a content-handling policy. It limits what OSP distributes. It is not legal clearance and does not establish that any use of upstream content is permitted.

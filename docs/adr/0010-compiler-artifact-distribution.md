# ADR 0010: Compiler artifact distribution

Status: Accepted

## Context

The game compiles C in the browser with `psyq-wasm`. Its compiler and preprocessor artifacts are GPL-2.0-only: `cc1psx.wasm`, `cc1psx.js`, `cccp.wasm`, and `cccp.js`. Every deployment that includes them distributes GPL works. Each such deployment must therefore carry license notices, identify the exact artifacts, and give access to their corresponding source.

The bundler cannot be left to handle the package. `psyq-wasm` creates its worker with a literal `new Worker(new URL('./worker.js', import.meta.url))`. Vite detects that literal and emits the worker as a minified chunk, with both glue files inlined. A test build confirmed it. The shipped glue then no longer matches the release's hashes, and the two compiler modules are emitted a second time under hashed names.

## Decision

- **Verbatim copy.** The build ships `psyq-wasm`'s browser runtime byte-for-byte under `vendor/psyq-wasm/<version>/`. That covers:
  - the worker entry and every module it imports;
  - both compiler modules;
  - `LICENSE` and `LICENSES/`;
  - `PROVENANCE.md`, `SHA256SUMS`, and `build-info.json`.

  The game creates its compiler with explicit worker and module URLs in that directory.

- **Build plugin.**
  - The plugin rewrites the package's four default asset URLs to point at the vendor directory, so the bundler never follows them.
  - The build fails if the installed package does not contain exactly those four URLs.
  - The build also fails if the package's version, artifact bytes, `SHA256SUMS`, or `build-info.json` disagree with the pinned release.
- **Corresponding source.** The build downloads the release's corresponding-source archive once into an ignored cache. It verifies the archive against a pinned SHA-256 and publishes it in the vendor directory.
- **Notices.** The notices file includes `psyq-wasm`'s full license texts. It ends with a section naming each artifact's SHA-256, the provenance records, the compiler source commit, and the source archive.
- **Audit.** `pnpm audit:distribution` checks the built site and fails unless all of these hold:
  - the notices are complete;
  - each artifact is present with its pinned hash;
  - the license and provenance records are present;
  - the source archive is present with its pinned hash;
  - no other script contains a compiler build ID, which would mean a transformed glue copy;
  - no other file is a copy of a compiler module.

  The audit runs in `pnpm check`, in CI after the build, and in the Pages workflow before upload.

## Consequences

- The first build on a machine needs network access to fetch the source archive, about 8 MB. Every deployment carries the archive.
- Upgrading `psyq-wasm` means updating every pinned release value: version, artifact hashes, build IDs, compiler source, and archive hash. The build then checks that the new version still creates its worker the expected way.
- The audit is a distribution check, not legal review. It does not decide the license of OSP's own code.

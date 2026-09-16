# Third-party notices

The deployed game distributes third-party software. Every production build writes `THIRD_PARTY_NOTICES.txt` to the root of the built site.

That file is generated from the modules actually bundled into the build. For each third-party package it lists:

- the package name and exact version;
- its declared license;
- the full text of its license file.

A few packages publish no license file. For those, the build uses a text in `apps/game/build/licenses/`, copied verbatim from the project's repository at the exact released version, and only while the package's version and declared license match that text. Any other bundled package without a license file fails the build, so a deployment cannot ship a dependency without its notice. Development-only tools, such as the test runner, linter, and bundler, are not part of the built site and are not listed.

The distributed packages currently include:

| Package                                                                                | License              | Contents                                                                      |
| -------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------- |
| `react`, `react-dom`, `scheduler`                                                      | MIT                  | User interface runtime                                                        |
| `@fontsource/ibm-plex-mono`                                                            | OFL-1.1              | IBM Plex Mono font files                                                      |
| `@fontsource/ibm-plex-sans`                                                            | OFL-1.1              | IBM Plex Sans font files                                                      |
| `@fontsource/barlow-condensed`                                                         | OFL-1.1              | Barlow Condensed font files                                                   |
| `psyq-wasm`                                                                            | MIT AND GPL-2.0-only | PsyQ 4.4 compiler and preprocessor (WebAssembly) and their TypeScript wrapper |
| `psyq-asm`                                                                             | MIT                  | ASPSX-compatible assembler and R3000 decoder                                  |
| `zod`                                                                                  | MIT                  | Schema validation                                                             |
| `@codemirror/*`, `@lezer/*`                                                            | MIT                  | C source editor, syntax highlighting, and parser                              |
| `style-mod`, `w3c-keyname`, `crelt`                                                    | MIT                  | Editor styling and keyboard support used by CodeMirror                        |
| `three`                                                                                | MIT                  | 3D rendering for the decorative training-chamber background                   |
| `@react-three/fiber`                                                                   | MIT                  | React renderer for the decorative 3D background                               |
| `zustand`, `its-fine`, `suspend-react`, `react-use-measure`, `use-sync-external-store` | MIT                  | Runtime support used by `@react-three/fiber`                                  |

The generated `THIRD_PARTY_NOTICES.txt` in each build is authoritative. This table is a summary.

## Compiler artifacts

`psyq-wasm` applies its licenses per file. Its wrapper is MIT. Its compiler and preprocessor artifacts, `cc1psx.wasm`, `cc1psx.js`, `cccp.wasm`, and `cccp.js`, are GPL-2.0-only. The notices entry for `psyq-wasm` therefore includes its `LICENSE` file and both texts from its `LICENSES/` directory.

The site ships those artifacts unmodified in `vendor/psyq-wasm/<version>/`, together with:

- `LICENSE` and `LICENSES/`;
- `PROVENANCE.md`, `SHA256SUMS`, and `build-info.json`, which identify the exact artifacts and the sources they were built from;
- the release's corresponding-source archive.

The notices file ends with a section that lists each artifact's SHA-256, the compiler source commit, and the archive's location and hash. `pnpm audit:distribution` fails any built site where these do not hold.

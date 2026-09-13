# Third-party notices

The deployed game distributes third-party software. Every production build writes `THIRD_PARTY_NOTICES.txt` to the root of the built site.

That file is generated from the modules actually bundled into the build. For each third-party package it lists:

- the package name and exact version;
- its declared license;
- the full text of its license file.

The build fails if a bundled package has no license file, so a deployment cannot ship a dependency without its notice. Development-only tools, such as the test runner, linter, and bundler, are not part of the built site and are not listed.

The distributed packages currently include:

| Package                           | License | Contents                    |
| --------------------------------- | ------- | --------------------------- |
| `react`, `react-dom`, `scheduler` | MIT     | User interface runtime      |
| `@fontsource/ibm-plex-mono`       | OFL-1.1 | IBM Plex Mono font files    |
| `@fontsource/barlow-condensed`    | OFL-1.1 | Barlow Condensed font files |

The generated `THIRD_PARTY_NOTICES.txt` in each build is authoritative. This table is a summary.

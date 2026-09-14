/**
 * The pinned psyq-wasm release whose compiler artifacts the site distributes.
 *
 * `cc1psx.wasm`, `cc1psx.js`, `cccp.wasm`, and `cccp.js` are GPL-2.0-only.
 * Every deployment ships them byte-for-byte, with their license texts,
 * provenance, and the release's corresponding-source archive. The hashes
 * below come from the release's `SHA256SUMS`; the build fails if the
 * installed package disagrees with them. Upgrading psyq-wasm means updating
 * every value here from the new release.
 */
export interface PsyqWasmRelease {
  readonly version: string;
  /** Where the runtime lives in the built site, relative to its root. */
  readonly vendorDirectory: string;
  /** SHA-256 of each GPL-2.0-only artifact, by file name. */
  readonly artifacts: Readonly<Record<string, string>>;
  /**
   * The `BUILD_ID` string each glue file embeds. A built script other than
   * the verbatim glue files that contains one holds a transformed copy.
   */
  readonly buildIds: readonly string[];
  /** The compiler sources the artifacts were built from. */
  readonly compilerSource: {
    readonly repository: string;
    readonly commit: string;
    readonly subdirectory: string;
  };
  readonly sourceArchive: {
    readonly fileName: string;
    readonly url: string;
    readonly sha256: string;
  };
}

export const PSYQ_WASM_RELEASE: PsyqWasmRelease = {
  version: "1.0.0",
  vendorDirectory: "vendor/psyq-wasm/1.0.0",
  artifacts: {
    "cc1psx.wasm":
      "e3cdde0d4dc69a95bd7d41721f516328601b997e4cfebe74744ca50ac3e35692",
    "cc1psx.js":
      "94c3b63610c1fdbadde100a19b1e658cd79ee110882f8865f0ac0408f24ceecf",
    "cccp.wasm":
      "12af84fbb68197fba46eeac2da107193f2265b45712880ee7952b17b7b1a0d93",
    "cccp.js":
      "004d1ad06f77699376a1054657d41b0daaaf4a6ad97cfd96cd7f6a6c350f98be",
  },
  buildIds: ["sha256:e3cdde0d4dc69a95", "sha256:12af84fbb68197fb"],
  compilerSource: {
    repository: "https://github.com/nocato/homebrew-psyq",
    commit: "bdee891005a0aec6bf6fe40e504cf068ebf38caf",
    subdirectory: "gcc-2.8.1_psyq-4.4",
  },
  sourceArchive: {
    fileName: "psyq-wasm-1.0.0-corresponding-source.tar.gz",
    url: "https://github.com/jaysonvirissimo/psyq-wasm/releases/download/v1.0.0/psyq-wasm-1.0.0-corresponding-source.tar.gz",
    sha256: "8f70f7899ddad8543674ec74076d9c5011a78a3f9d0b10340b7df2b29c28664e",
  },
};

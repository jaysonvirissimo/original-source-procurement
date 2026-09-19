/**
 * The upstream revisions one corpus is built from.
 *
 * Both repositories are pinned. `mgs_reversing` supplies the function
 * inventory, the source files, and every target's pre-match commit;
 * `psyq_sdk` supplies the PsyQ 4.4 headers upstream's default build includes.
 */
export interface CorpusConfig {
  readonly importerVersion: string;
  readonly upstreamCommit: string;
  readonly sdkCommit: string;
}

/**
 * The pinned revisions. They match the hand-authored feasibility pointer the
 * real-function proof already uses, so the importer's output can be compared
 * against it.
 */
export const CORPUS_CONFIG: CorpusConfig = {
  importerVersion: "1.4.0",
  upstreamCommit: "d8145676642e629623f5eaf036ed8e8b1c5e17af",
  sdkCommit: "91719fa5bdca0b7e55c5c4b9e045da407db93510",
};

/** Where the inventory of every function in the default build lives. */
export const FUNCTIONS_PATH = "build/functions.txt";

/** Preprocessor include directories, in upstream's search order. */
export const INCLUDE_PATHS = ["source", "source/include"] as const;

/** The directory of the corpus's working files, all of it git-ignored. */
export const REPORT_DIRECTORY = "tmp/reports/corpus";

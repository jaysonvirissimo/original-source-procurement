import type {
  CompilerSettings,
  RemoteCReference,
  RemoteWords,
} from "@osp/mission-schema";
import type { FeatureTag, FunctionFacts } from "./analysis.ts";
import type { ImportStatus } from "./inventory.ts";

export const IMPORT_INDEX_VERSION = 1;

/**
 * One upstream source file, with the compiler input upstream's default build
 * gives it. The compilation unit is the file, so its context is shared by
 * every function defined in it.
 */
export interface FileRecord {
  readonly path: string;
  readonly overlay: string;
  readonly gpSize: 0 | 8;
  readonly reference: RemoteCReference;
  readonly compiler: CompilerSettings;
  /** Files that carry assembly includes cannot be compiled on their own. */
  readonly includesAssembly: boolean;
}

/** Why a function has no usable target pointer. */
export interface FunctionRejection {
  readonly reason:
    | "no-deletion"
    | "no-parent"
    | "target-absent"
    | "no-words"
    | "word-count"
    | "duplicate-symbol"
    | "still-unmatched";
  readonly detail?: string;
}

/**
 * A pinned target and what its words show.
 *
 * The three travel together: the facts and the tags are read off the target's
 * own words, so a record has all of them or none.
 */
export interface PinnedTarget {
  /** The callees are learned later, from the verdicts (ADR 0024). */
  readonly target: RemoteWords;
  /**
   * Instruction counts from the target words. The difficulty profile is built
   * from them once the function's source file, and so its context, is known.
   */
  readonly facts: FunctionFacts;
  readonly tags: readonly FeatureTag[];
}

/** One function from upstream's inventory, with its target when it has one. */
export interface FunctionRecord {
  readonly symbol: string;
  readonly address: number;
  readonly size: number;
  readonly status: ImportStatus;
  readonly pinned?: PinnedTarget;
  readonly rejection?: FunctionRejection;
}

/**
 * Everything the importer can determine without compiling. It is written to
 * the ignored report directory, never committed: which upstream file defines
 * which function is only known once the file is built.
 */
export interface ImportIndex {
  readonly schemaVersion: typeof IMPORT_INDEX_VERSION;
  readonly importerVersion: string;
  readonly upstreamCommit: string;
  readonly sdkCommit: string;
  readonly files: readonly FileRecord[];
  readonly functions: readonly FunctionRecord[];
}

export const VERDICT_INDEX_VERSION = 2;

export type Verdict =
  | "exact"
  | "mismatch"
  | "function-missing"
  | "ambiguous"
  | "build-failed"
  | "unsupported";

/**
 * A call in an exact function: its word, the address its linked word jumps
 * to, and the callee the built object names there, when it names one.
 */
export interface VerdictCall {
  readonly word: number;
  readonly address: number;
  readonly symbol?: string;
}

/** What building a function's source file proved about it. */
export interface FunctionVerdict {
  readonly symbol: string;
  readonly sourcePath: string;
  readonly verdict: Verdict;
  /** Every call, for an exact verdict (ADR 0024). */
  readonly calls?: readonly VerdictCall[];
  readonly mismatchKinds?: readonly string[];
  readonly detail?: string;
}

/** What building one source file produced, for the review report. */
export interface FileVerdict {
  readonly path: string;
  readonly outcome: "built" | "build-failed" | "unsupported";
  readonly definedFunctions: number;
  readonly detail?: string;
}

export interface VerdictIndex {
  readonly schemaVersion: typeof VERDICT_INDEX_VERSION;
  readonly importerVersion: string;
  readonly upstreamCommit: string;
  readonly sdkCommit: string;
  readonly files: readonly FileVerdict[];
  readonly functions: readonly FunctionVerdict[];
}

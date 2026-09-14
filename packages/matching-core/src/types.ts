import type { RelocationKind, WordOrigin } from "psyq-asm";

/**
 * Base mismatch kinds. Kinds without a classification rule yet
 * (`INSTRUCTION_ORDER`, `BRANCH_CONDITION`, `BRANCH_TARGET`, `CALL_TARGET`,
 * `GP_RELATIVE`) are reported as `UNKNOWN` until their rules exist.
 */
export const MISMATCH_KINDS = [
  "OPCODE",
  "REGISTER",
  "IMMEDIATE",
  "MEMORY_OFFSET",
  "LOAD_WIDTH",
  "LOAD_SIGNEDNESS",
  "STORE_WIDTH",
  "MISSING_INSTRUCTION",
  "EXTRA_INSTRUCTION",
  "INSTRUCTION_ORDER",
  "BRANCH_CONDITION",
  "BRANCH_TARGET",
  "DELAY_SLOT",
  "CALL_TARGET",
  "GP_RELATIVE",
  "RELOCATION_TARGET",
  "UNKNOWN",
] as const;
export type MismatchKind = (typeof MISMATCH_KINDS)[number];

/** What a relocation points at. `label` is for display and never compared. */
export type RelocationTargetIdentity =
  | {
      readonly kind: "symbol";
      readonly name: string;
      readonly addend: number;
    }
  | {
      readonly kind: "section";
      readonly section: string;
      readonly offset: number;
      readonly label?: string | undefined;
    };

export interface FunctionRelocation {
  /** Bytes from the function's first word. */
  readonly offset: number;
  readonly kind: RelocationKind;
  readonly fieldMask: number;
  readonly fieldValue: number;
  readonly target: RelocationTargetIdentity;
}

/**
 * The words a function must match. Linked words (a real target) have final
 * addresses in their relocated fields and no relocation records. Unlinked
 * words (a synthetic target) come from the same assembler, so their
 * relocations are compared too.
 */
export type MatchTarget =
  | { readonly kind: "linked"; readonly words: ArrayLike<number> }
  | {
      readonly kind: "unlinked";
      readonly words: ArrayLike<number>;
      readonly relocations: readonly FunctionRelocation[];
    };

export interface GeneratedWord {
  readonly word: number;
  /** Bitwise OR of the field masks of every relocation at this word. */
  readonly mask: number;
  readonly origin: WordOrigin | undefined;
}

/** One assembled function from the player's build. */
export interface GeneratedFunction {
  readonly name: string;
  readonly words: readonly GeneratedWord[];
  readonly relocations: readonly FunctionRelocation[];
}

export interface MatchInstruction {
  /** Word index within the function. */
  readonly index: number;
  readonly word: number;
  readonly text: string;
  /** Generated side only. */
  readonly origin?: WordOrigin;
  /** Generated side: relocated bits. Always 0 on the target side. */
  readonly fieldMask: number;
}

/** Word indexes, start inclusive and end exclusive. Empty for an insertion point. */
export interface InstructionRange {
  readonly start: number;
  readonly end: number;
}

export type AlignmentStatus =
  "equal" | "field-only" | "different" | "inserted" | "deleted";

export interface AlignmentRow {
  /** Index into the target, absent for an inserted word. */
  readonly target?: number;
  /** Index into the generated words, absent for a deleted word. */
  readonly generated?: number;
  readonly status: AlignmentStatus;
  readonly mismatchIds: readonly string[];
}

export interface FieldDifference {
  /** Generated word index. */
  readonly index: number;
  readonly relocation: RelocationKind;
  readonly fieldMask: number;
  readonly target: number;
  readonly generated: number;
}

export interface Mismatch {
  readonly id: string;
  readonly kind: MismatchKind;
  readonly targetRange: InstructionRange;
  readonly generatedRange: InstructionRange;
  readonly confidence: number;
  readonly evidence: readonly string[];
  /** The mismatch that caused this inserted nop. */
  readonly consequenceOf?: string;
}

export interface MatchSummary {
  readonly exact: boolean;
  readonly equalWords: number;
  readonly targetWords: number;
  readonly generatedWords: number;
  readonly byKind: Partial<Record<MismatchKind, number>>;
}

export interface MatchResult {
  /** Authoritative. */
  readonly exact: boolean;
  /** Instructional only. */
  readonly score: number;
  readonly target: readonly MatchInstruction[];
  readonly generated: readonly MatchInstruction[];
  readonly alignment: readonly AlignmentRow[];
  readonly mismatches: readonly Mismatch[];
  readonly fieldDifferences: readonly FieldDifference[];
  readonly summary: MatchSummary;
}

export type MatchOutcome =
  | {
      readonly kind: "function-missing";
      readonly symbol: string;
      readonly definedFunctions: readonly string[];
    }
  | { readonly kind: "matched"; readonly result: MatchResult };

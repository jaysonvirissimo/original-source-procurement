export { ALIGNMENT_COSTS } from "./align.ts";
export {
  INSTRUCTION_CLASSES,
  LOAD_FORMS,
  STORE_BYTES,
  transfersControl,
  type Decoded,
  type InstructionClass,
  type LoadForm,
} from "./classes.ts";
export {
  observations,
  type Observation,
  type ObservationKind,
  type WordProvenance,
} from "./annotate.ts";
export {
  definedFunctions,
  extractFunction,
  functionFromWords,
} from "./extract.ts";
export {
  HYPOTHESIS_HEDGE,
  TEACHING_HYPOTHESIS_KINDS,
  teachingHypotheses,
  type TeachingHypothesis,
  type TeachingHypothesisKind,
} from "./hypotheses.ts";
export { compareFunction, matchFunction } from "./match.ts";
export {
  abiRegisterNames,
  usesStack,
  wordFacts,
  type BranchTest,
  type CallTarget,
  type JumpTarget,
  type MemoryAccess,
  type WordFacts,
} from "./scan.ts";
export {
  MISMATCH_KINDS,
  type AlignmentRow,
  type AlignmentStatus,
  type FieldDifference,
  type FunctionRelocation,
  type GeneratedFunction,
  type GeneratedWord,
  type InstructionRange,
  type MatchInstruction,
  type MatchOutcome,
  type MatchResult,
  type MatchSummary,
  type MatchTarget,
  type Mismatch,
  type MismatchKind,
  type RelocationTargetIdentity,
} from "./types.ts";

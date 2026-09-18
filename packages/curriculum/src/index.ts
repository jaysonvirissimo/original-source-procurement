import type { CurriculumData } from "./validate.ts";
import { manualEntries } from "./manual.ts";
import { defaultPath, missions as syntheticMissions } from "./missions.ts";
import { pointerCorpus } from "./real/corpus.ts";
import { feasibilityPointers } from "./real/feasibility.ts";
import { skills } from "./skills.ts";

export { manualEntries } from "./manual.ts";
export { defaultPath } from "./missions.ts";
export { pointerCorpus } from "./real/corpus.ts";
export { feasibilityPointers } from "./real/feasibility.ts";
export { skills } from "./skills.ts";
export {
  curriculumCoverage,
  type CoverageWarning,
  type CoverageWarningCode,
} from "./coverage.ts";
export { findCycle, missionNeeds } from "./graph.ts";
export { sha256Hex, wordsSha256 } from "./hash.ts";
export { TOOLCHAIN_PINS } from "./toolchainPins.ts";
export { runValidation, type ValidationOutput } from "./cli.ts";
export {
  validateCurriculum,
  type CurriculumData,
  type CurriculumIssue,
  type CurriculumIssueCode,
} from "./validate.ts";

/**
 * Every shipped mission: the authored synthetic missions, then the reviewed
 * real missions the importer generated from pinned upstream checkouts.
 */
export const missions = [...syntheticMissions, ...pointerCorpus.missions];

/** The shipped curriculum, as one validatable document set. */
export const curriculum: CurriculumData = {
  skills,
  manualEntries,
  missions,
  defaultPath,
  feasibilityPointers,
  pointerCorpus,
};

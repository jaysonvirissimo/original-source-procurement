import type { CurriculumData } from "./validate.ts";
import { manualEntries } from "./manual.ts";
import { defaultPath, missions } from "./missions.ts";
import { feasibilityPointers } from "./real/feasibility.ts";
import { skills } from "./skills.ts";

export { manualEntries } from "./manual.ts";
export { defaultPath, missions } from "./missions.ts";
export { feasibilityPointers } from "./real/feasibility.ts";
export { skills } from "./skills.ts";
export { findCycle, missionNeeds } from "./graph.ts";
export { sha256Hex, wordsSha256 } from "./hash.ts";
export { runValidation, type ValidationOutput } from "./cli.ts";
export {
  validateCurriculum,
  type CurriculumData,
  type CurriculumIssue,
  type CurriculumIssueCode,
} from "./validate.ts";

/** The shipped curriculum, as one validatable document set. */
export const curriculum: CurriculumData = {
  skills,
  manualEntries,
  missions,
  defaultPath,
  feasibilityPointers,
};

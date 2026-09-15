import { z } from "zod";
import { InstructionRangeSchema } from "./hint.ts";
import {
  ManualEntryIdSchema,
  SkillIdSchema,
  TextSchema,
} from "./primitives.ts";

/**
 * A mission-specific note on a range of target words, shown while the
 * player still gets automatic teaching. A note tied to a skill fades with
 * that skill; one without follows the mission's overall help level.
 */
export const MissionAnnotationSchema = z.strictObject({
  range: InstructionRangeSchema,
  text: TextSchema,
  manualEntry: ManualEntryIdSchema.optional(),
  skill: SkillIdSchema.optional(),
});
export type MissionAnnotation = z.infer<typeof MissionAnnotationSchema>;

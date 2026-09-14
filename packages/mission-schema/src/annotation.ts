import { z } from "zod";
import { InstructionRangeSchema } from "./hint.ts";
import { ManualEntryIdSchema, TextSchema } from "./primitives.ts";

/**
 * A mission-specific note on a range of target words, shown while the
 * mission's scaffold still offers automatic teaching.
 */
export const MissionAnnotationSchema = z.strictObject({
  range: InstructionRangeSchema,
  text: TextSchema,
  manualEntry: ManualEntryIdSchema.optional(),
});
export type MissionAnnotation = z.infer<typeof MissionAnnotationSchema>;

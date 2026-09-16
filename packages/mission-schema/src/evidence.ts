import { z } from "zod";
import { InstructionRangeSchema } from "./hint.ts";
import { TextSchema } from "./primitives.ts";

/**
 * What a demonstration asks the player to find before acknowledging: the
 * target words that show its evidence.
 */
export const EvidencePromptSchema = z.strictObject({
  question: TextSchema,
  range: InstructionRangeSchema,
  // Shown after a selection outside the range; it points without answering.
  retry: TextSchema,
});
export type EvidencePrompt = z.infer<typeof EvidencePromptSchema>;

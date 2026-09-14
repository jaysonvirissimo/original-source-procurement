import { z } from "zod";
import { TextSchema } from "./primitives.ts";
import { RemoteCReferenceSchema } from "./remote.ts";

/** A half-open range of target word indexes. */
export const InstructionRangeSchema = z
  .strictObject({
    start: z.number().int().min(0),
    end: z.number().int().min(1),
  })
  .refine((range) => range.end > range.start, {
    message: "An instruction range contains at least one word.",
    path: ["end"],
  });
export type InstructionRange = z.infer<typeof InstructionRangeSchema>;

/**
 * One rung of the hint ladder, from naming the skill (stage 1) to showing
 * the known solution (stage 9).
 */
export const HintSchema = z
  .strictObject({
    stage: z.number().int().min(1).max(9),
    text: TextSchema,
    highlight: InstructionRangeSchema.optional(),
    // Real-solved missions only: an upstream line span shown read-only.
    reveal: RemoteCReferenceSchema.optional(),
    // Synthetic missions only: shows the mission's OSP-authored solution.
    revealSolution: z.literal(true).optional(),
  })
  .refine(
    (hint) => hint.reveal === undefined || hint.revealSolution === undefined,
    {
      message: "A hint reveals upstream C or the mission solution, not both.",
      path: ["revealSolution"],
    },
  );
export type Hint = z.infer<typeof HintSchema>;

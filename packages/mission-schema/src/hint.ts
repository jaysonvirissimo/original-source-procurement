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
 * What each hint stage gives away, from stage 1 to stage 9. Each stage
 * reveals more than the one before it.
 */
export const HINT_STAGE_PURPOSES = [
  "Skill",
  "Where to look",
  "Machine behavior",
  "C category",
  "Type or declaration",
  "Expression shape",
  "Source skeleton",
  "Most of the source",
  "Solution",
] as const;

/** The purpose of a stage from 1 to 9. */
export function hintStagePurpose(stage: number): string {
  return HINT_STAGE_PURPOSES[stage - 1] ?? "";
}

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
    // Real-partial and live missions only: true for a verified fact, false
    // for a hypothesis.
    verified: z.boolean().optional(),
  })
  .refine(
    (hint) => hint.reveal === undefined || hint.revealSolution === undefined,
    {
      message: "A hint reveals upstream C or the mission solution, not both.",
      path: ["revealSolution"],
    },
  );
export type Hint = z.infer<typeof HintSchema>;

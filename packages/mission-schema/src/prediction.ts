import { z } from "zod";
import { TextSchema } from "./primitives.ts";

/** One short question the player answers before compiling. */
export const PredictionPromptSchema = z
  .strictObject({
    question: TextSchema,
    choices: z.array(TextSchema).min(2).max(4),
    // Index into choices.
    answer: z.number().int().min(0),
    // What in the assembled output shows the answer.
    revealedBy: TextSchema,
  })
  .superRefine((prompt, ctx) => {
    if (new Set(prompt.choices).size !== prompt.choices.length) {
      ctx.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Prediction choices must be distinct.",
      });
    }
    if (prompt.answer >= prompt.choices.length) {
      ctx.addIssue({
        code: "custom",
        path: ["answer"],
        message: "The prediction answer must index one of its choices.",
      });
    }
  });
export type PredictionPrompt = z.infer<typeof PredictionPromptSchema>;

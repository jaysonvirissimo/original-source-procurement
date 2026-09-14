import { z } from "zod";

/**
 * How a mission completes. Every rule is judged against a current build that
 * succeeded and defined the mission's function:
 *
 * - `exact`: the assembled function matches the target exactly;
 * - `acknowledge-evidence`: the player acknowledged the highlighted evidence;
 * - `prediction-recorded`: the player recorded a prediction before the build.
 */
export const COMPLETION_RULES = [
  "exact",
  "acknowledge-evidence",
  "prediction-recorded",
] as const;

export const CompletionRuleSchema = z.enum(COMPLETION_RULES);
export type CompletionRule = z.infer<typeof CompletionRuleSchema>;

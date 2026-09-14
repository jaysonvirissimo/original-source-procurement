import { z } from "zod";

const Score = z.number().min(0);

/** A static profile; instruction count alone never decides difficulty. */
export const DifficultyProfileSchema = z.strictObject({
  size: Score,
  controlFlow: Score,
  memory: Score,
  abi: Score,
  types: Score,
  compilerShaping: Score,
  context: Score,
  specialHardware: Score,
});
export type DifficultyProfile = z.infer<typeof DifficultyProfileSchema>;

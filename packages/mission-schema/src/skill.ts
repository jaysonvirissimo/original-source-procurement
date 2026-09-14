import { z } from "zod";
import {
  ManualEntryIdSchema,
  SkillIdSchema,
  TextSchema,
  uniqueArray,
} from "./primitives.ts";

export const SkillSchema = z
  .strictObject({
    id: SkillIdSchema,
    name: TextSchema,
    description: TextSchema,
    prerequisites: uniqueArray(SkillIdSchema),
    manualEntry: ManualEntryIdSchema,
  })
  .refine((skill) => !skill.prerequisites.includes(skill.id), {
    message: "A skill cannot be its own prerequisite.",
    path: ["prerequisites"],
  });
export type Skill = z.infer<typeof SkillSchema>;

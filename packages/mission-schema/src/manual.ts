import { z } from "zod";
import { ManualEntryIdSchema, TextSchema } from "./primitives.ts";

export const MANUAL_SECTIONS = [
  "C",
  "MIPS",
  "ABI",
  "MATCHING",
  "PS1",
  "FIELD GUIDE",
] as const;

export const ManualEntrySchema = z.strictObject({
  id: ManualEntryIdSchema,
  section: z.enum(MANUAL_SECTIONS),
  title: TextSchema,
  // Paragraphs of plain text.
  body: z.array(TextSchema).min(1),
});
export type ManualEntry = z.infer<typeof ManualEntrySchema>;

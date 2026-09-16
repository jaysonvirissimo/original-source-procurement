import { z } from "zod";
import { ManualEntryIdSchema, TextSchema } from "./primitives.ts";

/** Manual sections, in the order the manual lists them. */
export const MANUAL_SECTIONS = [
  "ORIENTATION",
  "TOOLS",
  "C",
  "MIPS",
  "ABI",
  "MATCHING",
  "PS1",
  "FIELD GUIDE",
  "GLOSSARY",
] as const;
export type ManualSection = (typeof MANUAL_SECTIONS)[number];

export const ManualEntrySchema = z.strictObject({
  id: ManualEntryIdSchema,
  section: z.enum(MANUAL_SECTIONS),
  title: TextSchema,
  // Paragraphs of plain text.
  body: z.array(TextSchema).min(1),
});
export type ManualEntry = z.infer<typeof ManualEntrySchema>;

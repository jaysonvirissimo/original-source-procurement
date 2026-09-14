import { z } from "zod";
import {
  CommitShaSchema,
  RelativePathSchema,
  Sha256HexSchema,
} from "./primitives.ts";

/**
 * The only repositories OSP reads. Both are fetched at runtime from pinned
 * commits and never committed or bundled.
 */
export const UPSTREAM_REPOSITORIES = [
  "FoxdieTeam/mgs_reversing",
  "FoxdieTeam/psyq_sdk",
] as const;

export const LineSpanSchema = z
  .strictObject({
    start: z.number().int().min(1),
    end: z.number().int().min(1),
  })
  .refine((span) => span.end >= span.start, {
    message: "A line span ends at or after its start.",
    path: ["end"],
  });

/**
 * A pointer to one whole upstream file. `sha256` covers the file's original
 * bytes. `lines` (1-based, inclusive) is the only part a hint displays.
 */
export const RemoteCReferenceSchema = z.strictObject({
  repository: z.enum(UPSTREAM_REPOSITORIES),
  commit: CommitShaSchema,
  path: RelativePathSchema,
  sha256: Sha256HexSchema,
  lines: LineSpanSchema.optional(),
});
export type RemoteCReference = z.infer<typeof RemoteCReferenceSchema>;

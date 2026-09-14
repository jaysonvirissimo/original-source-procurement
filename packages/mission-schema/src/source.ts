import { z } from "zod";
import {
  RelativePathSchema,
  SymbolSchema,
  TextSchema,
  Uint32Schema,
} from "./primitives.ts";

/** Where a mission's function comes from. Real missions record provenance. */
export const MissionSourceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("synthetic") }),
  z.strictObject({
    kind: z.literal("mgs-reversing"),
    repository: z.literal("FoxdieTeam/mgs_reversing"),
    build: z.literal("default"),
    overlay: TextSchema,
    symbol: SymbolSchema,
    address: Uint32Schema.optional(),
    sourcePath: RelativePathSchema.optional(),
    line: z.number().int().min(1).optional(),
  }),
]);
export type MissionSource = z.infer<typeof MissionSourceSchema>;

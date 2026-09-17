import { z } from "zod";

/** Text shown to players or reviewers; it must contain a visible character. */
export const TextSchema = z.string().regex(/\S/, "Expected non-empty text.");

/** Dotted upper-case segments, such as `ABI.RETURN` or `MIPS.LOAD.BYTE`. */
export const SkillIdSchema = z
  .string()
  .regex(
    /^[A-Z][A-Z0-9_]*(?:\.[A-Z][A-Z0-9_]*)+$/,
    "Skill IDs are dotted upper-case segments, such as ABI.RETURN.",
  );
export type SkillId = z.infer<typeof SkillIdSchema>;

/** Mission IDs appear in hash routes, so they stay URL-safe. */
export const MissionIdSchema = z
  .string()
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9_.-]*$/,
    "Mission IDs use letters, digits, '_', '.', and '-'.",
  );

/** Manual entry IDs appear in hash routes, such as `mips.loads-and-stores`. */
export const ManualEntryIdSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/,
    "Manual entry IDs are lower-case words joined by '.' or '-'.",
  );

/** A C identifier naming the function a mission compares. */
export const SymbolSchema = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Expected a C identifier.");

/**
 * A type the player reasons about by layout: a typedef name such as `KCB`,
 * or a tagged aggregate such as `struct Mixed`. Names only, never members.
 */
export const ContextTypeNameSchema = z
  .string()
  .regex(
    /^(?:(?:struct|union) )?[A-Za-z_][A-Za-z0-9_]*$/,
    "Context types are a C type name, optionally after 'struct ' or 'union '.",
  );

export const Sha256HexSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "Expected a lowercase hexadecimal SHA-256 digest.");

export const CommitShaSchema = z
  .string()
  .regex(/^[0-9a-f]{40}$/, "Expected a full lowercase 40-character commit.");

export const Uint32Schema = z.number().int().min(0).max(0xffff_ffff);

/**
 * Accepts a relative, forward-slash path with no empty, `.`, or `..`
 * segments, so it can never escape the directory it is resolved against.
 */
export function isSafeRelativePath(path: string): boolean {
  if (path.includes("\\")) {
    return false;
  }
  return path
    .split("/")
    .every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

export const RelativePathSchema = z
  .string()
  .refine(
    isSafeRelativePath,
    "Expected a relative path with no empty, '.', or '..' segments.",
  );

/** An array schema that rejects repeated entries. */
export function uniqueArray<T extends z.ZodType>(item: T) {
  return z
    .array(item)
    .refine(
      (values) => new Set(values).size === values.length,
      "Entries must be unique.",
    );
}

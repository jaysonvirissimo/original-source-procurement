import { z } from "zod";
import {
  CommitShaSchema,
  RelativePathSchema,
  Sha256HexSchema,
  SymbolSchema,
  TextSchema,
  Uint32Schema,
} from "./primitives.ts";

export const RELOCATION_KINDS = [
  "HI16",
  "LO16",
  "GPREL16",
  "MIPS26",
  "WORD32",
] as const;

/**
 * Mirrors the assembler's structured relocation target. It is never
 * flattened to a string, because the addend is often the only difference
 * between two references.
 */
export const RelocationTargetSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("symbol"),
    name: TextSchema,
    addend: z.number().int(),
  }),
  z.strictObject({
    kind: z.literal("section"),
    section: TextSchema,
    // Includes the addend.
    offset: z.number().int(),
    label: TextSchema.optional(),
  }),
]);
export type RelocationTarget = z.infer<typeof RelocationTargetSchema>;

export const RelocationSchema = z.strictObject({
  // Bytes from the function's first word.
  offset: z.number().int().min(0),
  kind: z.enum(RELOCATION_KINDS),
  fieldMask: Uint32Schema,
  fieldValue: Uint32Schema,
  target: RelocationTargetSchema,
});
export type Relocation = z.infer<typeof RelocationSchema>;

/** The assembler's explanation of where one word came from. */
export const WordOriginSchema = z.strictObject({
  kind: TextSchema,
  macro: TextSchema.optional(),
  note: TextSchema.optional(),
});

/**
 * A synthetic mission's target, generated from its OSP-authored solution
 * with the pinned compiler and assembler.
 */
export const InlineTargetSchema = z
  .strictObject({
    kind: z.literal("inline"),
    words: z.array(Uint32Schema).min(1),
    relocations: z.array(RelocationSchema),
    provenance: z.array(WordOriginSchema),
    toolchain: z.strictObject({
      ospCommit: CommitShaSchema,
      psyqWasmVersion: TextSchema,
      compilerBuildId: TextSchema,
      preprocessorBuildId: TextSchema,
      psyqAsmVersion: TextSchema,
    }),
    solutionSha256: Sha256HexSchema,
    wordsSha256: Sha256HexSchema,
  })
  .superRefine((target, ctx) => {
    if (target.provenance.length !== target.words.length) {
      ctx.addIssue({
        code: "custom",
        path: ["provenance"],
        message: "Provenance needs exactly one entry per word.",
      });
    }
    target.relocations.forEach((relocation, index) => {
      if (
        relocation.offset % 4 !== 0 ||
        relocation.offset >= target.words.length * 4
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["relocations", index, "offset"],
          message:
            "A relocation offset must fall on a word inside the function.",
        });
      }
    });
  });
export type InlineTarget = z.infer<typeof InlineTargetSchema>;

/**
 * One call in a real target: the word holding the `jal`, and the function it
 * calls. A linked word carries only an address, which OSP neither commits
 * nor can compare against an unlinked object, so the name is recorded by
 * the importer from upstream's own reproduction.
 */
export const RemoteCallSchema = z.strictObject({
  word: z.number().int().min(0),
  symbol: SymbolSchema,
});
export type RemoteCall = z.infer<typeof RemoteCallSchema>;

const remoteTargetFields = {
  kind: z.literal("remote"),
  // For a solved function, the parent of the commit that matched it.
  commit: CommitShaSchema,
  path: RelativePathSchema.refine(
    (path) => path.startsWith("asm/") && path.endsWith(".s"),
    "A remote target points to an asm/**.s file.",
  ),
  wordCount: z.number().int().positive(),
  // SHA-256 of the words as little-endian 32-bit values.
  wordsSha256: Sha256HexSchema,
};

/**
 * Where a real target's words live, without what the importer learns by
 * reproducing them. This is all a loader needs to fetch and check the words.
 */
export const RemoteWordsSchema = z.strictObject(remoteTargetFields);
export type RemoteWords = z.infer<typeof RemoteWordsSchema>;

/**
 * A real mission's target: a pointer to an upstream `asm/**.s` file, the
 * hash of its words, and every call in it (ADR 0024). The words themselves
 * are fetched at runtime. `calls` is required, and empty for a function
 * that calls nothing, so a pointer cannot leave its calls unchecked by
 * omission.
 */
export const RemoteTargetSchema = z
  .strictObject({
    ...remoteTargetFields,
    calls: z.array(RemoteCallSchema),
  })
  .superRefine((target, ctx) => {
    target.calls.forEach((call, index) => {
      if (call.word >= target.wordCount) {
        ctx.addIssue({
          code: "custom",
          path: ["calls", index, "word"],
          message: "A call must fall on a word inside the function.",
        });
      }
      const previous = target.calls[index - 1];
      if (previous !== undefined && call.word <= previous.word) {
        ctx.addIssue({
          code: "custom",
          path: ["calls", index, "word"],
          message: "Calls are listed once each, in word order.",
        });
      }
    });
  });
export type RemoteTarget = z.infer<typeof RemoteTargetSchema>;

export const TargetSchema = z.discriminatedUnion("kind", [
  InlineTargetSchema,
  RemoteTargetSchema,
]);
export type Target = z.infer<typeof TargetSchema>;

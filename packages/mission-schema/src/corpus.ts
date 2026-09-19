import { z } from "zod";
import { isRealMissionKind, MissionSchema } from "./mission.ts";
import { CommitShaSchema, TextSchema } from "./primitives.ts";

export const CORPUS_SCHEMA_VERSION = 1;

/**
 * The toolchain a real function was proved with. A real target is linked
 * upstream words, not OSP's own output, so it cannot be regenerated; what
 * goes stale on a toolchain bump is the proof that its known source still
 * reproduces it. Validation compares this with the pinned toolchain, and a
 * rerun of the reproduction with checkouts is the only way to update it.
 */
export const VerifiedToolchainSchema = z.strictObject({
  psyqWasmVersion: TextSchema,
  psyqAsmVersion: TextSchema,
});
export type VerifiedToolchain = z.infer<typeof VerifiedToolchainSchema>;

/**
 * Real-mission pointers written by the importer. The corpus holds commits,
 * paths, and hashes only; upstream content is fetched at runtime.
 */
export const PointerCorpusSchema = z
  .strictObject({
    schemaVersion: z.literal(CORPUS_SCHEMA_VERSION),
    importerVersion: TextSchema,
    // The pinned mgs_reversing checkout the importer read.
    upstreamCommit: CommitShaSchema,
    // The pinned psyq_sdk checkout the importer read.
    sdkCommit: CommitShaSchema,
    // What `pnpm corpus:verify` ran with when it proved every mission here.
    toolchain: VerifiedToolchainSchema,
    missions: z.array(MissionSchema),
  })
  .superRefine((corpus, ctx) => {
    corpus.missions.forEach((mission, index) => {
      if (!isRealMissionKind(mission.kind)) {
        ctx.addIssue({
          code: "custom",
          path: ["missions", index, "kind"],
          message: "The pointer corpus holds only real missions.",
        });
      }
    });
  });
export type PointerCorpus = z.infer<typeof PointerCorpusSchema>;

import { z } from "zod";
import { isRealMissionKind, MissionSchema } from "./mission.ts";
import { CommitShaSchema, TextSchema } from "./primitives.ts";

export const CORPUS_SCHEMA_VERSION = 1;

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

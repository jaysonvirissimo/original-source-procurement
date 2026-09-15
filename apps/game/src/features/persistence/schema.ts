import {
  ASPSX_VERSIONS,
  MissionIdSchema,
  SkillIdSchema,
} from "@osp/mission-schema";
import { z } from "zod";

/** The version of the player-state record shapes. */
export const PLAYER_SCHEMA_VERSION = 1;

/**
 * The curriculum a save was made against. Training missions carry their
 * targets inline, so this stays fixed until missions point at upstream.
 */
export const CORPUS_VERSION = "training";

export const EVIDENCE_KINDS = [
  "introduced",
  "practiced",
  "synthesis",
  "real",
] as const;

const TimestampSchema = z.iso.datetime();
const CountSchema = z.number().int().min(0);
const HintStageSchema = z.number().int().min(0).max(9);
const RecordIdSchema = z.string().min(1).max(200);

// Keyed by name rather than an enum, so new mismatch kinds need no migration.
const MismatchKindNameSchema = z.string().regex(/^[A-Z][A-Z_]*$/);

export const MismatchSummarySchema = z.strictObject({
  exact: z.boolean(),
  equalWords: CountSchema,
  targetWords: CountSchema,
  byKind: z.record(MismatchKindNameSchema, CountSchema),
});

/** One compile that produced a comparison. Source is kept exactly as typed. */
export const AttemptSchema = z.strictObject({
  id: RecordIdSchema,
  missionId: MissionIdSchema,
  createdAt: TimestampSchema,
  source: z.string(),
  exact: z.boolean(),
  score: z.number().min(0).max(1),
  mismatchSummary: MismatchSummarySchema,
  compilerBuildId: z.string(),
  preprocessorBuildId: z.string(),
  psyqAsmVersion: z.string(),
  aspsxVersion: z.enum(ASPSX_VERSIONS),
  pinned: z.boolean(),
  // The highest hint stage opened when this build ran. Optional, so saves
  // from before it was recorded still load.
  hintStage: HintStageSchema.optional(),
});
export type Attempt = z.infer<typeof AttemptSchema>;

/** The best comparison so far; kept apart so pruning attempts never loses it. */
export const BestMatchSchema = z.strictObject({
  attemptId: RecordIdSchema,
  exact: z.boolean(),
  score: z.number().min(0).max(1),
  equalWords: CountSchema,
  targetWords: CountSchema,
});
export type BestMatch = z.infer<typeof BestMatchSchema>;

export const CompletionRecordSchema = z.strictObject({
  count: z.number().int().min(1),
  firstCompletedAt: TimestampSchema,
  lastCompletedAt: TimestampSchema,
  lastCompletionId: RecordIdSchema,
});
export type CompletionRecord = z.infer<typeof CompletionRecordSchema>;

/** A prediction answered before a completing build. Never changes skill state. */
export const PredictionEvidenceSchema = z.strictObject({
  id: RecordIdSchema,
  completionId: RecordIdSchema,
  missionId: MissionIdSchema,
  choice: CountSchema,
  correct: z.boolean(),
  recordedAt: TimestampSchema,
});
export type PredictionEvidence = z.infer<typeof PredictionEvidenceSchema>;

/** One skill's share of one mission completion. */
export const SkillEvidenceSchema = z.strictObject({
  id: RecordIdSchema,
  completionId: RecordIdSchema,
  skill: SkillIdSchema,
  missionId: MissionIdSchema,
  kind: z.enum(EVIDENCE_KINDS),
  hintMaxStage: HintStageSchema,
  solutionRevealed: z.boolean(),
  completedAt: TimestampSchema,
});
export type SkillEvidence = z.infer<typeof SkillEvidenceSchema>;

const missionRecordShape = {
  missionId: MissionIdSchema,
  source: z.string(),
  sourceSavedAt: TimestampSchema,
  hintMaxStage: HintStageSchema,
  completion: CompletionRecordSchema.optional(),
  bestMatch: BestMatchSchema.optional(),
  predictions: z.array(PredictionEvidenceSchema),
};

/** A mission's progress as stored, without its attempts. */
export const MissionRecordSchema = z.strictObject(missionRecordShape);
export type MissionRecord = z.infer<typeof MissionRecordSchema>;

export const MissionProgressSchema = z.strictObject({
  ...missionRecordShape,
  attempts: z.array(AttemptSchema),
});
export type MissionProgress = z.infer<typeof MissionProgressSchema>;

export const SkillProgressSchema = z.strictObject({
  evidence: z.array(SkillEvidenceSchema),
});
export type SkillProgress = z.infer<typeof SkillProgressSchema>;

/**
 * How teaching help is chosen: `adaptive` fades it per skill, `full` always
 * gives each mission's most help, and `minimal` turns automatic overlays off.
 */
export const SCAFFOLD_SETTINGS = ["adaptive", "full", "minimal"] as const;
export type ScaffoldSetting = (typeof SCAFFOLD_SETTINGS)[number];

/**
 * `full` draws the decorative 3D background; `simple` never starts WebGL and
 * keeps the flat grid.
 */
export const GRAPHICS_SETTINGS = ["full", "simple"] as const;
export type GraphicsSetting = (typeof GRAPHICS_SETTINGS)[number];

/** `system` follows the browser's reduced-motion preference; `reduced` always reduces. */
export const MOTION_SETTINGS = ["system", "reduced"] as const;
export type MotionSetting = (typeof MOTION_SETTINGS)[number];

const AudioChannelSchema = z.strictObject({
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
});
export type AudioChannel = z.infer<typeof AudioChannelSchema>;

const AudioSettingsSchema = z.strictObject({
  music: AudioChannelSchema,
  sfx: AudioChannelSchema,
});
export type AudioSettings = z.infer<typeof AudioSettingsSchema>;

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  music: { volume: 0.6, muted: false },
  sfx: { volume: 0.8, muted: false },
};

// Fields are optional with defaults read through accessors, so adding one
// needs no migration and older saves stay valid.
export const SettingsSchema = z.strictObject({
  scaffold: z.enum(SCAFFOLD_SETTINGS).optional(),
  graphics: z.enum(GRAPHICS_SETTINGS).optional(),
  motion: z.enum(MOTION_SETTINGS).optional(),
  audio: AudioSettingsSchema.optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export function scaffoldSetting(settings: Settings): ScaffoldSetting {
  return settings.scaffold ?? "adaptive";
}

export function graphicsSetting(settings: Settings): GraphicsSetting {
  return settings.graphics ?? "full";
}

export function motionSetting(settings: Settings): MotionSetting {
  return settings.motion ?? "system";
}

export function audioSettings(settings: Settings): AudioSettings {
  return settings.audio ?? DEFAULT_AUDIO_SETTINGS;
}

export const PlayerStateSchema = z
  .strictObject({
    schemaVersion: z.literal(PLAYER_SCHEMA_VERSION),
    corpusVersion: z.string(),
    missions: z.record(MissionIdSchema, MissionProgressSchema),
    skills: z.record(SkillIdSchema, SkillProgressSchema),
    settings: SettingsSchema,
  })
  .superRefine((state, ctx) => {
    for (const [key, mission] of Object.entries(state.missions)) {
      if (mission.missionId !== key) {
        ctx.addIssue({
          code: "custom",
          path: ["missions", key, "missionId"],
          message: "A mission's progress is keyed by its mission ID.",
        });
      }
      mission.attempts.forEach((attempt, index) => {
        if (attempt.missionId !== key) {
          ctx.addIssue({
            code: "custom",
            path: ["missions", key, "attempts", index, "missionId"],
            message: "An attempt belongs to the mission that holds it.",
          });
        }
      });
    }
    for (const [key, skill] of Object.entries(state.skills)) {
      skill.evidence.forEach((evidence, index) => {
        if (evidence.skill !== key) {
          ctx.addIssue({
            code: "custom",
            path: ["skills", key, "evidence", index, "skill"],
            message: "Skill evidence is keyed by its skill ID.",
          });
        }
      });
    }
  });
export type PlayerState = z.infer<typeof PlayerStateSchema>;

export function emptyPlayerState(): PlayerState {
  return {
    schemaVersion: PLAYER_SCHEMA_VERSION,
    corpusVersion: CORPUS_VERSION,
    missions: {},
    skills: {},
    settings: {},
  };
}

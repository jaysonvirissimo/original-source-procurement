import {
  ContextTypeNameSchema,
  HintSchema,
  ManualEntryIdSchema,
  MissionIdSchema,
  realMissionTextIssues,
  SkillIdSchema,
  SymbolSchema,
  REAL_MISSION_KINDS,
  SCAFFOLD_LEVELS,
  uniqueArray,
} from "@osp/mission-schema";
import { z } from "zod";

/**
 * The reviewed, maintainer-authored half of a real mission.
 *
 * Everything a pointer can be derived from is imported; everything a player
 * reads is written by hand. The importer merges the two and never invents
 * teaching text, so a reviewed mission changes only when this file does.
 */
export const MissionOverrideSchema = z.strictObject({
  /** The upstream function this mission is built from. */
  symbol: SymbolSchema,
  id: MissionIdSchema,
  title: z.string().min(1),
  phase: z.string().min(1),
  kind: z.enum(REAL_MISSION_KINDS),
  scaffold: z.enum(SCAFFOLD_LEVELS),
  requires: z.array(SkillIdSchema),
  practices: z.array(SkillIdSchema),
  briefing: z.strictObject({
    objective: z.string().min(1),
    newTechnique: z.string().min(1).optional(),
  }),
  /** Types the offset table lays out: names only, never declarations. */
  contextTypes: z.array(ContextTypeNameSchema).min(1).optional(),
  /** Glossary entries the mission lists under This mission in the Manual. */
  terms: uniqueArray(ManualEntryIdSchema).optional(),
  starterSource: z.string(),
  hints: z.array(HintSchema),
  /** When a maintainer last reviewed this entry, as YYYY-MM-DD. */
  reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD."),
});
export type MissionOverride = z.infer<typeof MissionOverrideSchema>;

export const OVERRIDES_SCHEMA_VERSION = 1;

/** Every text a player reads in a reviewed mission, with its path. */
function playerText(
  mission: MissionOverride,
): { readonly path: readonly (string | number)[]; readonly text: string }[] {
  return [
    { path: ["title"], text: mission.title },
    { path: ["briefing", "objective"], text: mission.briefing.objective },
    ...(mission.briefing.newTechnique === undefined
      ? []
      : [
          {
            path: ["briefing", "newTechnique"],
            text: mission.briefing.newTechnique,
          },
        ]),
    ...mission.hints.map((hint, index) => ({
      path: ["hints", index, "text"],
      text: hint.text,
    })),
  ];
}

export const MissionOverridesSchema = z
  .strictObject({
    schemaVersion: z.literal(OVERRIDES_SCHEMA_VERSION),
    missions: z.array(MissionOverrideSchema),
  })
  .superRefine((file, ctx) => {
    const duplicate = (values: readonly string[]): string | undefined =>
      values.find((value, index) => values.indexOf(value) !== index);

    for (const key of ["symbol", "id"] as const) {
      const repeated = duplicate(file.missions.map((mission) => mission[key]));
      if (repeated !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["missions"],
          message: `Two reviewed missions share the ${key} ${repeated}.`,
        });
      }
    }

    file.missions.forEach((mission, index) => {
      for (const { path, text } of playerText(mission)) {
        for (const issue of realMissionTextIssues(text)) {
          ctx.addIssue({
            code: "custom",
            path: ["missions", index, ...path],
            message: `Real-mission text ${issue}; point at the highlighted target rows instead.`,
          });
        }
      }
    });
  });
export type MissionOverrides = z.infer<typeof MissionOverridesSchema>;

/** Where the reviewed overrides live, relative to the repository root. */
export const OVERRIDES_PATH = "tools/mgs-importer/overrides/real-missions.json";

/** Parses the overrides file, reporting every problem at once. */
export function parseOverrides(text: string): MissionOverrides {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`${OVERRIDES_PATH} is not valid JSON.`, { cause: error });
  }
  const result = MissionOverridesSchema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `${OVERRIDES_PATH} is not a valid overrides file:\n${issues}`,
    );
  }
  return result.data;
}

import { z } from "zod";
import { MissionAnnotationSchema } from "./annotation.ts";
import { checkUpstreamBuild, CompilerSettingsSchema } from "./compiler.ts";
import { CompletionRuleSchema } from "./completion.ts";
import { DifficultyProfileSchema } from "./difficulty.ts";
import { checkExample, MissionExampleSchema } from "./example.ts";
import { HintSchema } from "./hint.ts";
import { PredictionPromptSchema } from "./prediction.ts";
import {
  MissionIdSchema,
  SkillIdSchema,
  SymbolSchema,
  TextSchema,
  uniqueArray,
} from "./primitives.ts";
import { MissionSourceSchema } from "./source.ts";
import { TargetSchema } from "./target.ts";

export const MISSION_SCHEMA_VERSION = 1;

export const SYNTHETIC_MISSION_KINDS = [
  "demo",
  "prediction",
  "training",
  "diagnosis",
  "synthesis",
] as const;

export const REAL_MISSION_KINDS = [
  "real-solved",
  "real-partial",
  "live",
] as const;

export const MISSION_KINDS = [
  ...SYNTHETIC_MISSION_KINDS,
  ...REAL_MISSION_KINDS,
] as const;
export type MissionKind = (typeof MISSION_KINDS)[number];

export function isRealMissionKind(
  kind: MissionKind,
): kind is (typeof REAL_MISSION_KINDS)[number] {
  return (REAL_MISSION_KINDS as readonly MissionKind[]).includes(kind);
}

/** The most help a mission offers, from most to least. */
export const SCAFFOLD_LEVELS = [
  "guided",
  "assisted",
  "independent",
  "field",
] as const;

const MissionObjectSchema = z.strictObject({
  schemaVersion: z.literal(MISSION_SCHEMA_VERSION),
  id: MissionIdSchema,
  title: TextSchema,
  phase: TextSchema,
  kind: z.enum(MISSION_KINDS),
  source: MissionSourceSchema,
  requires: uniqueArray(SkillIdSchema),
  teaches: uniqueArray(SkillIdSchema),
  // Required when a non-synthesis mission teaches more than one skill.
  teachesOverride: z.strictObject({ reason: TextSchema }).optional(),
  practices: uniqueArray(SkillIdSchema),
  scaffold: z.enum(SCAFFOLD_LEVELS),
  completion: CompletionRuleSchema,
  compiler: CompilerSettingsSchema,
  briefing: z.strictObject({
    objective: TextSchema,
    newTechnique: TextSchema.optional(),
  }),
  // OSP-authored; for real missions, a signature stub.
  starterSource: z.string(),
  // Synthetic missions only: OSP-authored, shown by hint stage 9.
  solution: TextSchema.optional(),
  symbol: SymbolSchema,
  target: TargetSchema,
  prediction: PredictionPromptSchema.optional(),
  hints: z.array(HintSchema),
  // Synthetic missions only: notes on target words for guided play.
  annotations: z.array(MissionAnnotationSchema).optional(),
  // Synthetic missions only: made-up values for machine diagrams.
  example: MissionExampleSchema.optional(),
  difficulty: DifficultyProfileSchema,
});
type MissionShape = z.infer<typeof MissionObjectSchema>;
type IssuePath = readonly (string | number)[];

export const MissionSchema = MissionObjectSchema.superRefine((mission, ctx) => {
  const report = (path: IssuePath, message: string) => {
    ctx.addIssue({ code: "custom", path: [...path], message });
  };
  checkSourceAndTarget(mission, report);
  checkTaughtSkills(mission, report);
  checkHints(mission, report);
  checkAnnotations(mission, report);
  if (mission.example !== undefined) {
    if (mission.target.kind === "inline") {
      checkExample(
        mission.example,
        new Set([...mission.teaches, ...mission.practices]),
        report,
      );
    } else {
      report(
        ["example"],
        "Only missions with an inline target carry example values.",
      );
    }
  }
  if (
    (mission.kind === "prediction" ||
      mission.completion === "prediction-recorded") &&
    mission.prediction === undefined
  ) {
    report(
      ["prediction"],
      "Prediction missions and the prediction-recorded rule need a prediction prompt.",
    );
  }
});
export type Mission = z.infer<typeof MissionSchema>;

type Report = (path: IssuePath, message: string) => void;

function checkAnnotations(mission: MissionShape, report: Report): void {
  if (mission.annotations === undefined) {
    return;
  }
  if (mission.target.kind !== "inline") {
    report(
      ["annotations"],
      "Only missions with an inline target annotate target words.",
    );
    return;
  }
  const wordCount = mission.target.words.length;
  const listed = new Set([...mission.teaches, ...mission.practices]);
  mission.annotations.forEach((annotation, index) => {
    if (annotation.range.end > wordCount) {
      report(
        ["annotations", index, "range"],
        "An annotation must stay inside the target function.",
      );
    }
    if (annotation.skill !== undefined && !listed.has(annotation.skill)) {
      report(
        ["annotations", index, "skill"],
        "An annotation's skill must be one the mission teaches or practices.",
      );
    }
  });
}

function checkSourceAndTarget(mission: MissionShape, report: Report): void {
  if (!isRealMissionKind(mission.kind)) {
    if (mission.source.kind !== "synthetic") {
      report(["source"], "Synthetic missions use a synthetic source.");
    }
    if (mission.target.kind !== "inline") {
      report(
        ["target"],
        "Synthetic missions carry an inline target generated from their solution.",
      );
    }
    return;
  }

  if (mission.source.kind !== "mgs-reversing") {
    report(["source"], "Real missions must record their upstream provenance.");
  } else if (mission.source.symbol !== mission.symbol) {
    report(["symbol"], "A real mission's symbol must match its source symbol.");
  }
  if (mission.target.kind !== "remote") {
    report(
      ["target"],
      "Real missions point to a remote target and carry no inline words.",
    );
  }
  if (mission.solution !== undefined) {
    report(["solution"], "Only synthetic missions carry a solution.");
  }
  checkUpstreamBuild(mission.compiler, "Real missions", report);
}

function checkTaughtSkills(mission: MissionShape, report: Report): void {
  const synthesis = mission.kind === "synthesis";
  if (synthesis && mission.teaches.length > 0) {
    report(["teaches"], "Synthesis missions teach no new skill.");
  } else if (
    mission.teaches.length > 1 &&
    mission.teachesOverride === undefined
  ) {
    report(
      ["teaches"],
      "A mission teaches at most one skill unless teachesOverride explains why.",
    );
  }
  if (
    mission.teachesOverride !== undefined &&
    (synthesis || mission.teaches.length <= 1)
  ) {
    report(
      ["teachesOverride"],
      "teachesOverride is only for missions that teach more than one skill.",
    );
  }
}

function checkHints(mission: MissionShape, report: Report): void {
  const real = isRealMissionKind(mission.kind);
  const wordCount =
    mission.target.kind === "inline"
      ? mission.target.words.length
      : mission.target.wordCount;
  let previousStage = 0;

  mission.hints.forEach((hint, index) => {
    const at = (...rest: (string | number)[]) => ["hints", index, ...rest];

    if (hint.stage <= previousStage) {
      report(at("stage"), "Hint stages must strictly increase.");
    }
    previousStage = Math.max(previousStage, hint.stage);

    if (hint.highlight !== undefined && hint.highlight.end > wordCount) {
      report(
        at("highlight"),
        "A highlight must stay inside the target function.",
      );
    }

    if (hint.reveal !== undefined) {
      if (
        mission.kind !== "real-solved" ||
        (hint.stage !== 5 && hint.stage !== 9)
      ) {
        report(
          at("reveal"),
          "Only real-solved missions reveal upstream C, and only at stages 5 and 9.",
        );
      } else if (
        hint.stage === 9 &&
        hint.reveal.repository === "FoxdieTeam/psyq_sdk"
      ) {
        report(
          at("reveal", "repository"),
          "A stage 9 reveal shows the function's own source from mgs_reversing, never psyq_sdk.",
        );
      }
      if (hint.reveal.lines === undefined) {
        report(
          at("reveal", "lines"),
          "A revealed upstream file shows only its referenced line span.",
        );
      }
    }

    if (hint.revealSolution !== undefined && (real || hint.stage !== 9)) {
      report(
        at("revealSolution"),
        "Only a synthetic mission's stage 9 hint reveals its solution.",
      );
    }

    if (hint.stage !== 9) {
      return;
    }
    if (mission.kind === "live") {
      report(
        at("stage"),
        "Live missions have no known solution, so they have no stage 9 hint.",
      );
    } else if (real) {
      if (hint.reveal === undefined) {
        report(
          at("reveal"),
          "A real-solved stage 9 hint reveals the known solution's line span.",
        );
      }
    } else {
      if (mission.solution === undefined) {
        report(
          ["solution"],
          "A synthetic mission with a stage 9 hint must include its solution.",
        );
      }
      if (hint.revealSolution === undefined) {
        report(
          at("revealSolution"),
          "A synthetic stage 9 hint reveals the mission solution.",
        );
      }
    }
  });
}

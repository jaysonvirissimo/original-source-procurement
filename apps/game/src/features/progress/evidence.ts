import { isRealMissionKind, type Mission } from "@osp/mission-schema";
import type { PredictionEvidence, SkillEvidence } from "../persistence/schema";

export type EvidenceMission = Pick<
  Mission,
  "id" | "kind" | "requires" | "teaches" | "practices" | "hints" | "prediction"
>;

export interface CompletionFacts {
  readonly completionId: string;
  /** The highest hint stage opened, or 0. */
  readonly hintStage: number;
  readonly completedAt: string;
  /** The prediction choice recorded before the completing build. */
  readonly predictionChoice?: number;
}

export interface CompletionEvidence {
  readonly skills: SkillEvidence[];
  readonly prediction?: PredictionEvidence;
}

/**
 * The evidence one completion records: one event per listed skill, and the
 * prediction result, which is kept apart from skill evidence.
 */
export function completionEvidence(
  mission: EvidenceMission,
  facts: CompletionFacts,
): CompletionEvidence {
  const kinds = new Map<string, SkillEvidence["kind"]>();
  const add = (skills: readonly string[], kind: SkillEvidence["kind"]) => {
    for (const skill of skills) {
      if (!kinds.has(skill)) {
        kinds.set(skill, kind);
      }
    }
  };
  if (isRealMissionKind(mission.kind)) {
    add([...mission.requires, ...mission.practices], "real");
  } else if (mission.kind === "synthesis") {
    add([...mission.requires, ...mission.practices], "synthesis");
  } else {
    add(mission.teaches, "introduced");
    add(mission.practices, "practiced");
  }

  const solutionRevealed = mission.hints.some(
    (hint) => hint.stage === 9 && hint.stage <= facts.hintStage,
  );
  const skills = [...kinds].map(([skill, kind]): SkillEvidence => ({
    id: `${facts.completionId}:${skill}`,
    completionId: facts.completionId,
    skill,
    missionId: mission.id,
    kind,
    hintMaxStage: facts.hintStage,
    solutionRevealed,
    completedAt: facts.completedAt,
  }));

  const { prediction } = mission;
  const choice = facts.predictionChoice;
  if (prediction === undefined || choice === undefined) {
    return { skills };
  }
  return {
    skills,
    prediction: {
      id: `${facts.completionId}:prediction`,
      completionId: facts.completionId,
      missionId: mission.id,
      choice,
      correct: choice === prediction.answer,
      recordedAt: facts.completedAt,
    },
  };
}

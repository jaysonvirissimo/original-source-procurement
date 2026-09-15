import { SCAFFOLD_LEVELS, type Mission } from "@osp/mission-schema";
import type { ScaffoldSetting } from "../persistence/schema";
import type { SkillState } from "./skillState";

/** Help decreases from `guided` to `field`. */
export type ScaffoldLevel = Mission["scaffold"];

const LEVEL_FOR_STATE: Readonly<Record<SkillState, ScaffoldLevel>> = {
  NEW: "guided",
  INTRODUCED: "guided",
  PRACTICED: "assisted",
  DEMONSTRATED: "independent",
  MASTERED: "field",
};

export function levelForState(state: SkillState): ScaffoldLevel {
  return LEVEL_FOR_STATE[state];
}

/** A level limited to at most the help `cap` allows. */
export function capLevel(
  level: ScaffoldLevel,
  cap: ScaffoldLevel,
): ScaffoldLevel {
  return SCAFFOLD_LEVELS.indexOf(level) >= SCAFFOLD_LEVELS.indexOf(cap)
    ? level
    : cap;
}

export interface ScaffoldPlan {
  /** The workspace's default level: the most help any listed skill gets. */
  readonly layout: ScaffoldLevel;
  /** The level of each skill the mission teaches or practices. */
  readonly skills: ReadonlyMap<string, ScaffoldLevel>;
  /** False when the player turned automatic teaching overlays off. */
  readonly automaticTeaching: boolean;
}

/**
 * How much help a mission gives. A mission's `scaffold` is the most help it
 * offers; within it, each skill gets less help as the player's state rises.
 */
export function selectScaffold(
  mission: Pick<Mission, "scaffold" | "teaches" | "practices">,
  stateOf: (skill: string) => SkillState,
  setting: ScaffoldSetting,
): ScaffoldPlan {
  const listed = [...new Set([...mission.teaches, ...mission.practices])];
  const skills = new Map(
    listed.map((skill): [string, ScaffoldLevel] => [
      skill,
      setting === "full"
        ? mission.scaffold
        : capLevel(levelForState(stateOf(skill)), mission.scaffold),
    ]),
  );
  const levels = [...skills.values()];
  const layout =
    levels.length === 0
      ? mission.scaffold
      : levels.reduce((most, level) =>
          SCAFFOLD_LEVELS.indexOf(level) < SCAFFOLD_LEVELS.indexOf(most)
            ? level
            : most,
        );
  return { layout, skills, automaticTeaching: setting !== "minimal" };
}

/** One line telling the player how much help a mission will show. */
export function supportLabel(plan: ScaffoldPlan): string {
  if (!plan.automaticTeaching) {
    return "Minimal: notes appear only through Scan.";
  }
  switch (plan.layout) {
    case "guided":
      return "Guided: notes and their explanations appear on their own.";
    case "assisted":
      return "Assisted: short labels appear; Scan explains them.";
    case "independent":
      return "Independent: notes appear only through Scan.";
    case "field":
      return "Field: a plain workspace; Scan, hints, and the manual stay available.";
  }
}

/** What a level shows without being asked. SCAN, hints, and the manual always remain. */
export interface Presentation {
  /** Short labels such as "delay slot" beside target words. */
  readonly noteLabels: boolean;
  /** Full plain-English notes under the listing. */
  readonly explanations: boolean;
  /** Machine diagrams under the listing. */
  readonly diagrams: boolean;
}

const PRESENTATIONS: Readonly<Record<ScaffoldLevel, Presentation>> = {
  guided: { noteLabels: true, explanations: true, diagrams: true },
  assisted: { noteLabels: true, explanations: false, diagrams: false },
  independent: { noteLabels: false, explanations: false, diagrams: false },
  field: { noteLabels: false, explanations: false, diagrams: false },
};

export function presentationFor(
  level: ScaffoldLevel,
  automaticTeaching: boolean,
): Presentation {
  return automaticTeaching ? PRESENTATIONS[level] : PRESENTATIONS.field;
}

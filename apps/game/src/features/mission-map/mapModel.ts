import { missionNeeds } from "@osp/curriculum";
import type { Mission } from "@osp/mission-schema";
import { missionTier, type MissionTier } from "../../vr/presentation";
import {
  orderedMissions,
  type MissionCatalog,
} from "../curriculum/missionCatalog";
import type { PlayerState } from "../persistence/schema";
import { missionStatus, type MissionStatus } from "../progress/progressReducer";
import { skillStateOf } from "../progress/skillState";

export interface NamedSkill {
  readonly id: string;
  readonly name: string;
}

/** One mission as the map shows it. */
export interface MissionEntry {
  readonly mission: Mission;
  readonly status: MissionStatus;
  readonly tier: MissionTier;
  /** Skills the mission expects that the player has not been introduced to. */
  readonly missing: readonly NamedSkill[];
  readonly recommended: boolean;
}

/** A training phase lane, or the field or live region. */
export interface MapRegion {
  readonly key: string;
  readonly kind: "phase" | Exclude<MissionTier, "training">;
  readonly title: string;
  readonly entries: readonly MissionEntry[];
}

export interface MissionMapModel {
  /** Every mission in recommended order. */
  readonly entries: readonly MissionEntry[];
  readonly regions: readonly MapRegion[];
  readonly recommended: MissionEntry | undefined;
  readonly resume: MissionEntry | undefined;
  readonly completed: number;
  readonly total: number;
}

type Catalog = Pick<MissionCatalog, "missions" | "skills" | "defaultPath">;

/**
 * Skills a mission expects that the player has never been introduced to. They
 * are a warning only: every mission stays open.
 */
export function missingSkills(
  mission: Pick<Mission, "requires" | "teaches" | "practices">,
  catalog: Pick<MissionCatalog, "skills">,
  skills: PlayerState["skills"],
): NamedSkill[] {
  const byId = new Map(catalog.skills.map((skill) => [skill.id, skill]));
  return missionNeeds(mission, byId)
    .filter((skill) => skillStateOf(skills, skill) === "NEW")
    .map((id) => ({ id, name: byId.get(id)?.name ?? id }));
}

/**
 * The map's view of the curriculum for this player.
 *
 * The recommended mission is the first incomplete mission, in recommended
 * order, whose expected skills the player has all been introduced to. When
 * none qualifies it is the first incomplete mission, and when every mission is
 * complete there is none. Resume is the started, incomplete mission whose
 * source was saved most recently; ties go to the earlier mission.
 */
export function missionMapModel(
  catalog: Catalog,
  state: Pick<PlayerState, "missions" | "skills">,
): MissionMapModel {
  const ordered = orderedMissions(catalog);
  const draft = ordered.map((mission) => ({
    mission,
    status: missionStatus(state.missions[mission.id]),
    tier: missionTier(mission.kind),
    missing: missingSkills(mission, catalog, state.skills),
  }));
  const incomplete = draft.filter((entry) => entry.status !== "complete");
  const recommendedId = (
    incomplete.find((entry) => entry.missing.length === 0) ?? incomplete[0]
  )?.mission.id;
  const entries: MissionEntry[] = draft.map((entry) => ({
    ...entry,
    recommended: entry.mission.id === recommendedId,
  }));

  let resume: MissionEntry | undefined;
  let resumeAt = "";
  for (const entry of entries) {
    const savedAt = state.missions[entry.mission.id]?.sourceSavedAt;
    if (
      entry.status === "in-progress" &&
      savedAt !== undefined &&
      savedAt > resumeAt
    ) {
      resume = entry;
      resumeAt = savedAt;
    }
  }

  return {
    entries,
    regions: mapRegions(entries),
    recommended: entries.find((entry) => entry.recommended),
    resume,
    completed: entries.length - incomplete.length,
    total: entries.length,
  };
}

/**
 * Text marks for an entry, so status never depends on color. A completed
 * mission shows only COMPLETE; otherwise marks say whether it is recommended,
 * started, or expects skills the player has not been introduced to.
 */
export function entryMarks(entry: MissionEntry): string[] {
  if (entry.status === "complete") {
    return ["COMPLETE"];
  }
  const marks: string[] = [];
  if (entry.recommended) {
    marks.push("RECOMMENDED");
  }
  if (entry.status === "in-progress") {
    marks.push("IN PROGRESS");
  }
  if (entry.missing.length > 0) {
    marks.push("SKIPS AHEAD");
  }
  return marks;
}

/** The skip-ahead warning for an incomplete entry, if it has one. */
export function missingSkillsText(
  missing: readonly NamedSkill[],
): string | undefined {
  return missing.length === 0
    ? undefined
    : `Not yet introduced: ${missing.map(({ name }) => name).join(", ")}.`;
}

const TIER_REGIONS = [
  { kind: "field", title: "Field" },
  { kind: "live", title: "Live" },
] as const;

/**
 * Training missions grouped into lanes by phase, in the order phases first
 * appear, then the field and live regions, which are present even when empty.
 */
export function mapRegions(entries: readonly MissionEntry[]): MapRegion[] {
  const lanes = new Map<string, MissionEntry[]>();
  for (const entry of entries) {
    if (entry.tier !== "training") {
      continue;
    }
    const lane = lanes.get(entry.mission.phase);
    if (lane === undefined) {
      lanes.set(entry.mission.phase, [entry]);
    } else {
      lane.push(entry);
    }
  }
  return [
    ...[...lanes].map(([phase, laneEntries]): MapRegion => ({
      key: `phase:${phase}`,
      kind: "phase",
      title: phase,
      entries: laneEntries,
    })),
    ...TIER_REGIONS.map(({ kind, title }): MapRegion => ({
      key: kind,
      kind,
      title,
      entries: entries.filter((entry) => entry.tier === kind),
    })),
  ];
}

/**
 * Entries whose ID, title, phase, or learner-facing skill names contain every
 * word of the query, ignoring case. A blank query keeps every entry.
 */
export function searchEntries(
  entries: readonly MissionEntry[],
  query: string,
  skillNames: ReadonlyMap<string, string>,
): MissionEntry[] {
  const words = query.toLowerCase().split(/\s+/u).filter(Boolean);
  return entries.filter(({ mission }) => {
    const text = [
      mission.id,
      mission.title,
      mission.phase,
      ...[...mission.requires, ...mission.teaches, ...mission.practices].map(
        (skill) => skillNames.get(skill) ?? skill,
      ),
    ]
      .join(" ")
      .toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

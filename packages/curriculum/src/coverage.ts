import { isRealMissionKind, type Mission } from "@osp/mission-schema";

export type CoverageWarningCode =
  "no-later-practice" | "phase-without-synthesis" | "no-early-real-mission";

export interface CoverageWarning {
  readonly code: CoverageWarningCode;
  readonly path: string;
  readonly message: string;
}

type CoverageMission = Pick<
  Mission,
  "id" | "phase" | "kind" | "teaches" | "practices" | "requires"
>;

/**
 * Checks that the default path keeps what it teaches in use: every taught
 * skill is practiced later, every map phase ends in a synthesis check, and a
 * real function appears before the final phase.
 *
 * These are course-shape findings rather than errors, so a curriculum that is
 * still growing can ship with them listed.
 */
export function curriculumCoverage(
  missions: readonly CoverageMission[],
  defaultPath: readonly string[],
): CoverageWarning[] {
  const byId = new Map(missions.map((mission) => [mission.id, mission]));
  const path = defaultPath.flatMap((id) => {
    const mission = byId.get(id);
    return mission === undefined ? [] : [mission];
  });
  return [
    ...laterPractice(path),
    ...phaseSynthesis(path),
    ...earlyRealMission(path),
  ];
}

function laterPractice(path: readonly CoverageMission[]): CoverageWarning[] {
  return path.flatMap((mission, index) => {
    const later = path.slice(index + 1);
    return mission.teaches.flatMap((skill) =>
      later.some(
        (next) =>
          next.practices.includes(skill) ||
          (checksSkills(next) && next.requires.includes(skill)),
      )
        ? []
        : [
            {
              code: "no-later-practice" as const,
              path: `defaultPath[${String(index)}]`,
              message: `${skill} is taught by ${mission.id} and never practiced later on the default path.`,
            },
          ],
    );
  });
}

function phaseSynthesis(path: readonly CoverageMission[]): CoverageWarning[] {
  const phases = new Map<string, CoverageMission[]>();
  for (const mission of path) {
    phases.set(mission.phase, [...(phases.get(mission.phase) ?? []), mission]);
  }
  return [...phases].flatMap(([phase, members]) =>
    members.some(checksSkills)
      ? []
      : [
          {
            code: "phase-without-synthesis" as const,
            path: `defaultPath[${String(path.findIndex((mission) => mission.phase === phase))}]`,
            message: `The phase "${phase}" has no synthesis or real mission on the default path.`,
          },
        ],
  );
}

function earlyRealMission(path: readonly CoverageMission[]): CoverageWarning[] {
  const finalPhase = path.at(-1)?.phase;
  if (finalPhase === undefined) return [];
  const firstOfFinal = path.findIndex(
    (mission) => mission.phase === finalPhase,
  );
  return path
    .slice(0, firstOfFinal)
    .some((mission) => isRealMissionKind(mission.kind))
    ? []
    : [
        {
          code: "no-early-real-mission",
          path: "defaultPath",
          message: `No real mission appears before the final phase, "${finalPhase}".`,
        },
      ];
}

/** Synthesis and real missions check skills rather than teach them. */
function checksSkills(mission: CoverageMission): boolean {
  return mission.kind === "synthesis" || isRealMissionKind(mission.kind);
}

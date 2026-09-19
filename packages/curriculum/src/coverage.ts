import { isRealMissionKind, type Mission } from "@osp/mission-schema";

export type CoverageIssueCode =
  | "no-later-practice"
  | "phase-without-synthesis"
  | "training-prefix"
  | "real-before-its-check";

export interface CoverageIssue {
  readonly code: CoverageIssueCode;
  readonly path: string;
  readonly message: string;
}

type CoverageMission = Pick<
  Mission,
  "id" | "phase" | "kind" | "teaches" | "practices" | "requires"
>;

/**
 * Checks that the default path keeps what it teaches in use: every taught
 * skill is practised by a later mission, every map phase has a mission that
 * checks its skills, the synthetic missions come before every real one, and
 * a real mission comes after its own phase's qualification.
 *
 * `validateCurriculum` reports these as errors once everything else is valid.
 */
export function curriculumCoverage(
  missions: readonly CoverageMission[],
  defaultPath: readonly string[],
): CoverageIssue[] {
  const byId = new Map(missions.map((mission) => [mission.id, mission]));
  const path = defaultPath.flatMap((id) => {
    const mission = byId.get(id);
    return mission === undefined ? [] : [mission];
  });
  return [
    ...laterPractice(path),
    ...phaseSynthesis(path),
    ...trainingPrefix(path),
    ...realAfterItsCheck(path),
  ];
}

/**
 * A skill counts as practised only where a later mission lists it under
 * `practices`, which says the listing exercises it. A qualification that
 * merely requires the skill does not show it to the player.
 */
function laterPractice(path: readonly CoverageMission[]): CoverageIssue[] {
  return path.flatMap((mission, index) => {
    const later = path.slice(index + 1);
    return mission.teaches.flatMap((skill) =>
      later.some((next) => next.practices.includes(skill))
        ? []
        : [
            {
              code: "no-later-practice" as const,
              path: `defaultPath[${String(index)}]`,
              message: `${skill} is taught by ${mission.id} and no later mission on the default path practises it.`,
            },
          ],
    );
  });
}

function phaseSynthesis(path: readonly CoverageMission[]): CoverageIssue[] {
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

/**
 * The synthetic missions are one contiguous run before every real one. The
 * map draws real missions in their own region, and the course hands a player
 * upstream material only once training is over.
 */
function trainingPrefix(path: readonly CoverageMission[]): CoverageIssue[] {
  const firstReal = path.findIndex((mission) =>
    isRealMissionKind(mission.kind),
  );
  if (firstReal === -1) return [];
  // One misplaced real mission puts every later synthetic one out of order,
  // so only the first is reported.
  const index = path.findIndex(
    (mission, at) => at > firstReal && !isRealMissionKind(mission.kind),
  );
  const synthetic = path[index];
  return synthetic === undefined
    ? []
    : [
        {
          code: "training-prefix",
          path: `defaultPath[${String(index)}]`,
          message: `${synthetic.id} is a synthetic mission after the first real one, ${String(path[firstReal]?.id)}.`,
        },
      ];
}

/**
 * A real mission labelled with a phase comes after that phase's
 * qualification, so the player has been checked on the skills before meeting
 * them on upstream material. A phase with no synthesis mission, such as the
 * field missions' own, sets no such order.
 */
function realAfterItsCheck(path: readonly CoverageMission[]): CoverageIssue[] {
  return path.flatMap((mission, index) => {
    if (!isRealMissionKind(mission.kind)) return [];
    const checks = path.filter(
      (other) => other.kind === "synthesis" && other.phase === mission.phase,
    );
    const late = checks.filter((check) => path.indexOf(check) > index);
    return late.map((check) => ({
      code: "real-before-its-check" as const,
      path: `defaultPath[${String(index)}]`,
      message: `${mission.id} is in the phase "${mission.phase}" but comes before its qualification, ${check.id}.`,
    }));
  });
}

/** Synthesis and real missions check skills rather than teach them. */
function checksSkills(mission: CoverageMission): boolean {
  return mission.kind === "synthesis" || isRealMissionKind(mission.kind);
}

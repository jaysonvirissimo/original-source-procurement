import {
  FeasibilityPointerSchema,
  ManualEntrySchema,
  MissionSchema,
  PointerCorpusSchema,
  SkillSchema,
  type ManualEntry,
  type Mission,
  type Skill,
  realMissionTextIssues,
} from "@osp/mission-schema";
import { findCycle, missionNeeds } from "./graph.ts";
import { sha256Hex, wordsSha256 } from "./hash.ts";

export type CurriculumIssueCode =
  | "schema"
  | "duplicate-manual-entry"
  | "duplicate-skill"
  | "duplicate-mission"
  | "unknown-skill"
  | "unknown-manual-entry"
  | "skill-cycle"
  | "unknown-mission"
  | "duplicate-path-entry"
  | "unreachable-prerequisite"
  | "solution-hash"
  | "words-hash"
  | "corpus-commit"
  | "corpus-symbol"
  | "corpus-text";

export interface CurriculumIssue {
  readonly code: CurriculumIssueCode;
  readonly path: string;
  readonly message: string;
}

/** Curriculum data as authored. Entries are validated, so they start unknown. */
export interface CurriculumData {
  readonly skills: readonly unknown[];
  readonly manualEntries: readonly unknown[];
  readonly missions: readonly unknown[];
  readonly defaultPath: readonly string[];
  /** Pointers to real solved functions checked from local checkouts. */
  readonly feasibilityPointers?: readonly unknown[];
  /** The generated pointer corpus, whose missions are also in `missions`. */
  readonly pointerCorpus?: unknown;
}

type PathSegment = string | number | symbol;

export function formatPath(segments: readonly PathSegment[]): string {
  return segments
    .map((segment, index) => {
      if (typeof segment === "number") {
        return `[${String(segment)}]`;
      }
      return index === 0 ? String(segment) : `.${String(segment)}`;
    })
    .join("");
}

/**
 * Validates every document against its schema, then the rules that span
 * documents: unique IDs, known skills and manual entries, an acyclic skill
 * graph, a default path that never needs an untaught skill, and hashes that
 * match their inline content.
 */
export async function validateCurriculum(
  data: CurriculumData,
): Promise<CurriculumIssue[]> {
  const issues: CurriculumIssue[] = [];
  const report = (
    code: CurriculumIssueCode,
    path: readonly PathSegment[],
    message: string,
  ) => {
    issues.push({ code, path: formatPath(path), message });
  };

  const manualEntries = parseUnique(
    "manualEntries",
    data.manualEntries,
    (value) => ManualEntrySchema.safeParse(value),
    "duplicate-manual-entry",
    report,
  );
  const skills = parseUnique(
    "skills",
    data.skills,
    (value) => SkillSchema.safeParse(value),
    "duplicate-skill",
    report,
  );
  const missions = parseUnique(
    "missions",
    data.missions,
    (value) => MissionSchema.safeParse(value),
    "duplicate-mission",
    report,
  );

  checkSkillGraph(skills, manualEntries, report);
  checkMissionReferences(missions, skills, manualEntries, report);
  checkDefaultPath(data.defaultPath, missions, skills, report);
  await checkHashes(missions, report);
  checkFeasibilityPointers(data.feasibilityPointers ?? [], report);
  checkPointerCorpus(data.pointerCorpus, report);

  return issues;
}

type Report = (
  code: CurriculumIssueCode,
  path: readonly PathSegment[],
  message: string,
) => void;

interface Parsed<T> {
  readonly index: number;
  readonly value: T;
}

type SafeParse<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: {
        issues: readonly {
          path: readonly PathSegment[];
          message: string;
        }[];
      };
    };

function parseUnique<T extends { id: string }>(
  collection: string,
  values: readonly unknown[],
  parse: (value: unknown) => SafeParse<T>,
  duplicateCode: CurriculumIssueCode,
  report: Report,
): Map<string, Parsed<T>> {
  const byId = new Map<string, Parsed<T>>();
  values.forEach((value, index) => {
    const result = parse(value);
    if (!result.success) {
      for (const issue of result.error.issues) {
        report("schema", [collection, index, ...issue.path], issue.message);
      }
      return;
    }
    if (byId.has(result.data.id)) {
      report(
        duplicateCode,
        [collection, index, "id"],
        `The ID ${result.data.id} is already used.`,
      );
      return;
    }
    byId.set(result.data.id, { index, value: result.data });
  });
  return byId;
}

function checkSkillGraph(
  skills: ReadonlyMap<string, Parsed<Skill>>,
  manualEntries: ReadonlyMap<string, Parsed<ManualEntry>>,
  report: Report,
): void {
  for (const { index, value: skill } of skills.values()) {
    skill.prerequisites.forEach((prerequisite, position) => {
      if (!skills.has(prerequisite)) {
        report(
          "unknown-skill",
          ["skills", index, "prerequisites", position],
          `Unknown skill ${prerequisite}.`,
        );
      }
    });
    if (!manualEntries.has(skill.manualEntry)) {
      report(
        "unknown-manual-entry",
        ["skills", index, "manualEntry"],
        `Unknown manual entry ${skill.manualEntry}.`,
      );
    }
  }

  const cycle = findCycle(
    new Map(
      [...skills].map(([id, { value }]) => [id, value.prerequisites] as const),
    ),
  );
  if (cycle !== undefined) {
    report(
      "skill-cycle",
      ["skills"],
      `Skill prerequisites form a cycle: ${cycle.join(" → ")}.`,
    );
  }
}

const SKILL_LISTS = ["requires", "teaches", "practices"] as const;

function checkMissionReferences(
  missions: ReadonlyMap<string, Parsed<Mission>>,
  skills: ReadonlyMap<string, Parsed<Skill>>,
  manualEntries: ReadonlyMap<string, Parsed<ManualEntry>>,
  report: Report,
): void {
  for (const { index, value: mission } of missions.values()) {
    for (const list of SKILL_LISTS) {
      mission[list].forEach((skill, position) => {
        if (!skills.has(skill)) {
          report(
            "unknown-skill",
            ["missions", index, list, position],
            `Unknown skill ${skill}.`,
          );
        }
      });
    }
    mission.annotations?.forEach(({ manualEntry }, position) => {
      if (manualEntry !== undefined && !manualEntries.has(manualEntry)) {
        report(
          "unknown-manual-entry",
          ["missions", index, "annotations", position, "manualEntry"],
          `Unknown manual entry ${manualEntry}.`,
        );
      }
    });
  }
}

function checkDefaultPath(
  defaultPath: readonly string[],
  missions: ReadonlyMap<string, Parsed<Mission>>,
  skills: ReadonlyMap<string, Parsed<Skill>>,
  report: Report,
): void {
  const taught = new Set<string>();
  const seen = new Set<string>();
  const skillValues = new Map(
    [...skills].map(([id, { value }]) => [id, value] as const),
  );

  defaultPath.forEach((id, index) => {
    const at = ["defaultPath", index];
    const mission = missions.get(id)?.value;
    if (mission === undefined) {
      report("unknown-mission", at, `Unknown mission ${id}.`);
      return;
    }
    if (seen.has(id)) {
      report(
        "duplicate-path-entry",
        at,
        `Mission ${id} appears more than once.`,
      );
      return;
    }
    seen.add(id);

    for (const skill of missionNeeds(mission, skillValues)) {
      if (!taught.has(skill)) {
        report(
          "unreachable-prerequisite",
          at,
          `Mission ${id} needs ${skill}, which no earlier mission on the default path teaches.`,
        );
      }
    }
    for (const skill of mission.teaches) {
      taught.add(skill);
    }
  });
}

async function checkHashes(
  missions: ReadonlyMap<string, Parsed<Mission>>,
  report: Report,
): Promise<void> {
  for (const { index, value: mission } of missions.values()) {
    if (mission.target.kind !== "inline") {
      continue;
    }
    if (
      (await wordsSha256(mission.target.words)) !== mission.target.wordsSha256
    ) {
      report(
        "words-hash",
        ["missions", index, "target", "wordsSha256"],
        "wordsSha256 does not match the target words.",
      );
    }
    if (
      mission.solution !== undefined &&
      (await sha256Hex(mission.solution)) !== mission.target.solutionSha256
    ) {
      report(
        "solution-hash",
        ["missions", index, "target", "solutionSha256"],
        "solutionSha256 does not match the mission solution.",
      );
    }
  }
}

/**
 * Checks the generated pointer corpus.
 *
 * The schema covers a mission on its own. The rules here are the ones that
 * span the corpus: every reference must name the revision the corpus was
 * imported from, a target must be pinned to its own pre-match commit, and no
 * upstream function may appear twice.
 */
function checkPointerCorpus(value: unknown, report: Report): void {
  if (value === undefined) {
    return;
  }
  const result = PointerCorpusSchema.safeParse(value);
  if (!result.success) {
    for (const issue of result.error.issues) {
      report("schema", ["pointerCorpus", ...issue.path], issue.message);
    }
    return;
  }

  const corpus = result.data;
  const expected = {
    "FoxdieTeam/mgs_reversing": corpus.upstreamCommit,
    "FoxdieTeam/psyq_sdk": corpus.sdkCommit,
  };
  const seen = new Set<string>();

  corpus.missions.forEach((mission, index) => {
    const at = (...rest: readonly PathSegment[]) => [
      "pointerCorpus",
      "missions",
      index,
      ...rest,
    ];

    if (seen.has(mission.symbol)) {
      report(
        "corpus-symbol",
        at("symbol"),
        `Two corpus missions point at ${mission.symbol}.`,
      );
    }
    seen.add(mission.symbol);

    for (const [key, reference] of Object.entries(
      mission.compiler.remoteHeaders ?? {},
    )) {
      if (reference.commit !== expected[reference.repository]) {
        report(
          "corpus-commit",
          at("compiler", "remoteHeaders", key, "commit"),
          `A context header must come from the revision the corpus was imported from, ${expected[reference.repository]}.`,
        );
      }
    }

    for (const [hintIndex, hint] of mission.hints.entries()) {
      if (
        hint.reveal !== undefined &&
        hint.reveal.commit !== expected[hint.reveal.repository]
      ) {
        report(
          "corpus-commit",
          at("hints", hintIndex, "reveal", "commit"),
          `A revealed file must come from the revision the corpus was imported from, ${expected[hint.reveal.repository]}.`,
        );
      }
    }

    const texts: [readonly PathSegment[], string | undefined][] = [
      [["title"], mission.title],
      [["briefing", "objective"], mission.briefing.objective],
      [["briefing", "newTechnique"], mission.briefing.newTechnique],
      ...mission.hints.map(
        (hint, hintIndex): [readonly PathSegment[], string] => [
          ["hints", hintIndex, "text"],
          hint.text,
        ],
      ),
    ];
    for (const [path, text] of texts) {
      for (const issue of realMissionTextIssues(text ?? "")) {
        report(
          "corpus-text",
          at(...path),
          `Real-mission text ${issue}; point at the highlighted target rows instead.`,
        );
      }
    }

    if (
      mission.target.kind === "remote" &&
      mission.target.commit === corpus.upstreamCommit
    ) {
      report(
        "corpus-commit",
        at("target", "commit"),
        "A target is pinned to the commit before its function was matched, which is never the corpus commit.",
      );
    }
  });
}

function checkFeasibilityPointers(
  pointers: readonly unknown[],
  report: Report,
): void {
  pointers.forEach((value, index) => {
    const result = FeasibilityPointerSchema.safeParse(value);
    if (result.success) {
      return;
    }
    for (const issue of result.error.issues) {
      report(
        "schema",
        ["feasibilityPointers", index, ...issue.path],
        issue.message,
      );
    }
  });
}

import type { Mission, Skill } from "@osp/mission-schema";
import {
  feasibilityPointer,
  realMission,
  syntheticMission,
} from "@osp/mission-schema/testing";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { sha256Hex, wordsSha256 } from "./hash.ts";
import { curriculum } from "./index.ts";
import { dagArbitrary } from "./test-graphs.test-helpers.ts";
import {
  formatPath,
  validateCurriculum,
  type CurriculumData,
} from "./validate.ts";

const ENTRY = {
  id: "sample.entry",
  section: "C",
  title: "Sample",
  body: ["A sample entry."],
};

function skill(id: string, prerequisites: string[] = []): Skill {
  return {
    id,
    name: id,
    description: "A sample skill.",
    prerequisites,
    manualEntry: ENTRY.id,
  };
}

/** A synthetic mission whose target hashes match its words and solution. */
async function mission(overrides: Partial<Mission> = {}): Promise<Mission> {
  const base = syntheticMission(overrides);
  if (base.target.kind === "inline" && base.solution !== undefined) {
    base.target.wordsSha256 = await wordsSha256(base.target.words);
    base.target.solutionSha256 = await sha256Hex(base.solution);
  }
  return base;
}

function data(overrides: Partial<CurriculumData>): CurriculumData {
  return {
    skills: [skill("S.A"), skill("S.B", ["S.A"])],
    manualEntries: [ENTRY],
    missions: [],
    defaultPath: [],
    ...overrides,
  };
}

async function codes(input: CurriculumData) {
  return (await validateCurriculum(input)).map((issue) => issue.code);
}

describe("formatPath", () => {
  it("joins names with dots and indexes with brackets", () => {
    expect(formatPath(["missions", 3, "hints", 0, "stage"])).toBe(
      "missions[3].hints[0].stage",
    );
    expect(formatPath([Symbol.for("key")])).toBe("Symbol(key)");
  });
});

describe("validateCurriculum", () => {
  it("accepts the shipped curriculum", async () => {
    await expect(validateCurriculum(curriculum)).resolves.toEqual([]);
  });

  it("reports feasibility pointers that fail their schema", async () => {
    const pointer = feasibilityPointer();
    pointer.symbol = "other_function";
    await expect(
      validateCurriculum(
        data({ feasibilityPointers: [feasibilityPointer(), pointer] }),
      ),
    ).resolves.toEqual([
      {
        code: "schema",
        path: "feasibilityPointers[1].symbol",
        message: "A pointer's symbol must match its source symbol.",
      },
    ]);
  });

  describe("the pointer corpus", () => {
    const UPSTREAM = "1".repeat(40);
    const SDK = "2".repeat(40);
    const PRE_MATCH = "3".repeat(40);

    /** A corpus mission whose every reference names the corpus's revisions. */
    function corpusMission(overrides: Partial<Mission> = {}): Mission {
      const base = realMission();
      return {
        ...base,
        compiler: {
          ...base.compiler,
          remoteHeaders: {
            "psyq/include/sample.h": {
              repository: "FoxdieTeam/psyq_sdk",
              commit: SDK,
              path: "psyq_4.4/include/sample.h",
              sha256: "a".repeat(64),
            },
          },
        },
        target: {
          ...base.target,
          kind: "remote",
          commit: PRE_MATCH,
        } as Mission["target"],
        hints: base.hints.map((hint) =>
          hint.reveal === undefined
            ? hint
            : {
                ...hint,
                reveal: {
                  ...hint.reveal,
                  commit:
                    hint.reveal.repository === "FoxdieTeam/psyq_sdk"
                      ? SDK
                      : UPSTREAM,
                },
              },
        ),
        ...overrides,
      };
    }

    function corpus(missions: Mission[]) {
      return {
        schemaVersion: 1,
        importerVersion: "1.0.0",
        upstreamCommit: UPSTREAM,
        sdkCommit: SDK,
        missions,
      };
    }

    it("accepts a corpus whose references all name its revisions", async () => {
      await expect(
        codes(data({ pointerCorpus: corpus([corpusMission()]) })),
      ).resolves.toEqual([]);
    });

    it("accepts curriculum data that has no corpus", async () => {
      await expect(codes(data({}))).resolves.toEqual([]);
    });

    it("accepts a corpus mission whose source needs no context header", async () => {
      const mission_ = corpusMission();
      const bare = {
        ...mission_,
        compiler: { ...mission_.compiler, remoteHeaders: undefined },
      };
      await expect(
        codes(data({ pointerCorpus: corpus([bare]) })),
      ).resolves.toEqual([]);
    });

    it("reports a corpus that fails its schema", async () => {
      const issues = await validateCurriculum(
        data({ pointerCorpus: { schemaVersion: 2 } }),
      );
      expect(issues.every((issue) => issue.code === "schema")).toBe(true);
      expect(issues.map((issue) => issue.path)).toContain(
        "pointerCorpus.schemaVersion",
      );
    });

    it("reports a context header from another revision", async () => {
      const mission_ = corpusMission();
      const corpus_ = corpus([
        {
          ...mission_,
          compiler: {
            ...mission_.compiler,
            remoteHeaders: {
              "psyq/include/sample.h": {
                repository: "FoxdieTeam/psyq_sdk",
                commit: "9".repeat(40),
                path: "psyq_4.4/include/sample.h",
                sha256: "a".repeat(64),
              },
            },
          },
        },
      ]);
      await expect(codes(data({ pointerCorpus: corpus_ }))).resolves.toEqual([
        "corpus-commit",
      ]);
    });

    it("reports a revealed file from another revision", async () => {
      const mission_ = corpusMission();
      const corpus_ = corpus([
        {
          ...mission_,
          hints: mission_.hints.map((hint) =>
            hint.reveal === undefined
              ? hint
              : { ...hint, reveal: { ...hint.reveal, commit: "9".repeat(40) } },
          ),
        },
      ]);
      await expect(codes(data({ pointerCorpus: corpus_ }))).resolves.toEqual([
        "corpus-commit",
        "corpus-commit",
      ]);
    });

    it("reports real-mission text that quotes target instructions", async () => {
      const mission_ = corpusMission();
      const corpus_ = corpus([
        {
          ...mission_,
          briefing: {
            objective: "Match the function.",
            newTechnique: "Read the lw row.",
          },
          hints: mission_.hints.map((hint, index) =>
            index === 0 ? { ...hint, text: "The value is in $v0." } : hint,
          ),
        },
      ]);
      await expect(codes(data({ pointerCorpus: corpus_ }))).resolves.toEqual([
        "corpus-text",
        "corpus-text",
      ]);
    });

    it("reports a target pinned to the corpus commit", async () => {
      const mission_ = corpusMission();
      const corpus_ = corpus([
        {
          ...mission_,
          target: { ...mission_.target, commit: UPSTREAM } as Mission["target"],
        },
      ]);
      await expect(codes(data({ pointerCorpus: corpus_ }))).resolves.toEqual([
        "corpus-commit",
      ]);
    });

    it("reports two corpus missions that point at one function", async () => {
      await expect(
        codes(
          data({
            pointerCorpus: corpus([
              corpusMission(),
              corpusMission({ id: "sample-real-2" }),
            ]),
          }),
        ),
      ).resolves.toEqual(["corpus-symbol"]);
    });
  });

  it("accepts a consistent curriculum with a default path", async () => {
    const missions = [
      await mission({ id: "m1", teaches: ["S.A"] }),
      await mission({
        id: "m2",
        teaches: ["S.B"],
        requires: ["S.A"],
        practices: ["S.A", "S.B"],
      }),
    ];
    await expect(
      validateCurriculum(data({ missions, defaultPath: ["m1", "m2"] })),
    ).resolves.toEqual([]);
  });

  it("reports schema issues with their full path", async () => {
    await expect(
      validateCurriculum(data({ skills: [{ ...skill("S.A"), name: " " }] })),
    ).resolves.toEqual([
      {
        code: "schema",
        path: "skills[0].name",
        message: "Expected non-empty text.",
      },
    ]);
  });

  it("reports a mission that fails its schema", async () => {
    expect(
      await codes(data({ missions: [await mission({ kind: "synthesis" })] })),
    ).toEqual(["schema"]);
  });

  it("reports an unknown skill in a prerequisite and in a mission", async () => {
    const issues = await validateCurriculum(
      data({
        skills: [skill("S.A", ["S.MISSING"])],
        missions: [await mission({ practices: ["S.UNKNOWN"] })],
      }),
    );
    expect(issues).toEqual([
      {
        code: "unknown-skill",
        path: "skills[0].prerequisites[0]",
        message: "Unknown skill S.MISSING.",
      },
      {
        code: "unknown-skill",
        path: "missions[0].teaches[0]",
        message: "Unknown skill ABI.RETURN.",
      },
      {
        code: "unknown-skill",
        path: "missions[0].practices[0]",
        message: "Unknown skill S.UNKNOWN.",
      },
    ]);
  });

  it("reports an unknown manual entry", async () => {
    expect(
      await codes(
        data({ skills: [{ ...skill("S.A"), manualEntry: "nowhere" }] }),
      ),
    ).toEqual(["unknown-manual-entry"]);
  });

  it("reports an annotation linking an unknown manual entry", async () => {
    const annotated = await mission({
      teaches: ["S.A"],
      annotations: [
        {
          range: { start: 0, end: 1 },
          text: "Known.",
          manualEntry: ENTRY.id,
        },
        { range: { start: 1, end: 2 }, text: "Unlinked." },
        {
          range: { start: 1, end: 2 },
          text: "Unknown.",
          manualEntry: "nowhere",
        },
      ],
    });
    await expect(
      validateCurriculum(data({ missions: [annotated] })),
    ).resolves.toEqual([
      {
        code: "unknown-manual-entry",
        path: "missions[0].annotations[2].manualEntry",
        message: "Unknown manual entry nowhere.",
      },
    ]);
  });

  it("reports terms that are unknown or not glossary entries", async () => {
    const term = { ...ENTRY, id: "glossary.sample", section: "GLOSSARY" };
    const withTerms = await mission({
      teaches: ["S.A"],
      terms: [term.id, ENTRY.id, "nowhere"],
    });
    await expect(
      validateCurriculum(
        data({ manualEntries: [ENTRY, term], missions: [withTerms] }),
      ),
    ).resolves.toEqual([
      {
        code: "term-not-glossary",
        path: "missions[0].terms[1]",
        message: "Term sample.entry is not a GLOSSARY entry.",
      },
      {
        code: "unknown-manual-entry",
        path: "missions[0].terms[2]",
        message: "Unknown manual entry nowhere.",
      },
    ]);
  });

  it("reports a skill cycle", async () => {
    await expect(
      validateCurriculum(
        data({ skills: [skill("S.A", ["S.B"]), skill("S.B", ["S.A"])] }),
      ),
    ).resolves.toEqual([
      {
        code: "skill-cycle",
        path: "skills",
        message: "Skill prerequisites form a cycle: S.A → S.B → S.A.",
      },
    ]);
  });

  it("reports duplicate IDs", async () => {
    const one = await mission({ teaches: [] });
    expect(
      await codes(
        data({
          manualEntries: [ENTRY, ENTRY],
          skills: [skill("S.A"), skill("S.A")],
          missions: [one, one],
        }),
      ),
    ).toEqual([
      "duplicate-manual-entry",
      "duplicate-skill",
      "duplicate-mission",
    ]);
  });

  it("reports unknown and repeated default-path entries", async () => {
    const one = await mission({ id: "m1", teaches: [] });
    await expect(
      validateCurriculum(
        data({ missions: [one], defaultPath: ["m1", "nope", "m1"] }),
      ),
    ).resolves.toEqual([
      {
        code: "unknown-mission",
        path: "defaultPath[1]",
        message: "Unknown mission nope.",
      },
      {
        code: "duplicate-path-entry",
        path: "defaultPath[2]",
        message: "Mission m1 appears more than once.",
      },
    ]);
  });

  it("reports an unreachable prerequisite on the default path", async () => {
    const missions = [
      await mission({ id: "m2", teaches: ["S.B"] }),
      await mission({ id: "m1", teaches: ["S.A"] }),
    ];
    await expect(
      validateCurriculum(data({ missions, defaultPath: ["m2", "m1"] })),
    ).resolves.toEqual([
      {
        code: "unreachable-prerequisite",
        path: "defaultPath[0]",
        message:
          "Mission m2 needs S.A, which no earlier mission on the default path teaches.",
      },
    ]);
  });

  it("reports required and practiced skills that nothing earlier teaches", async () => {
    const missions = [
      await mission({
        id: "m1",
        teaches: [],
        requires: ["S.A"],
        practices: ["S.B"],
      }),
    ];
    expect(await codes(data({ missions, defaultPath: ["m1"] }))).toEqual([
      "unreachable-prerequisite",
      "unreachable-prerequisite",
    ]);
  });

  it("reports target hashes that do not match", async () => {
    const good = await mission({ teaches: [] });
    const bad = syntheticMission({ id: "bad", teaches: [] });
    const unsolved = syntheticMission({
      id: "unsolved",
      teaches: [],
      hints: [],
    });
    delete unsolved.solution;
    await expect(
      validateCurriculum(data({ missions: [good, bad, unsolved] })),
    ).resolves.toEqual([
      {
        code: "words-hash",
        path: "missions[1].target.wordsSha256",
        message: "wordsSha256 does not match the target words.",
      },
      {
        code: "solution-hash",
        path: "missions[1].target.solutionSha256",
        message: "solutionSha256 does not match the mission solution.",
      },
      {
        code: "words-hash",
        path: "missions[2].target.wordsSha256",
        message: "wordsSha256 does not match the target words.",
      },
    ]);
  });

  it("reports a taught skill missing from the catalog only once", async () => {
    const missions = [await mission({ id: "m1", teaches: ["S.MISSING"] })];
    expect(await codes(data({ missions, defaultPath: ["m1"] }))).toEqual([
      "unknown-skill",
    ]);
  });

  it("does not hash remote targets, whose content loads at runtime", async () => {
    await expect(
      validateCurriculum(data({ missions: [realMission({ requires: [] })] })),
    ).resolves.toEqual([]);
  });
});

describe("default path properties", () => {
  const generated = dagArbitrary(8).map((dag) => ({
    skills: dag.map(({ node, edges }) =>
      skill(
        `GEN.${node}`,
        edges.map((edge) => `GEN.${edge}`),
      ),
    ),
  }));

  async function pathFor(skills: readonly Skill[]) {
    return Promise.all(
      skills.map((taught) => mission({ id: taught.id, teaches: [taught.id] })),
    );
  }

  it("accepts any path that teaches skills in topological order", async () => {
    await fc.assert(
      fc.asyncProperty(generated, async ({ skills }) => {
        const missions = await pathFor(skills);
        const issues = await validateCurriculum(
          data({ skills, missions, defaultPath: missions.map((m) => m.id) }),
        );
        expect(issues).toEqual([]);
      }),
      { numRuns: 40 },
    );
  });

  it("reports an unreachable prerequisite when an earlier teacher is dropped", async () => {
    await fc.assert(
      fc.asyncProperty(generated, fc.nat(), async ({ skills }, pick) => {
        const dependents = skills.filter((s) => s.prerequisites.length > 0);
        fc.pre(dependents.length > 0);
        const dependent = dependents[pick % dependents.length];
        const dropped = dependent?.prerequisites[0];

        const missions = (await pathFor(skills)).filter(
          (m) => m.id !== dropped,
        );
        const issues = await validateCurriculum(
          data({ skills, missions, defaultPath: missions.map((m) => m.id) }),
        );
        expect(issues.map((issue) => issue.code)).toContain(
          "unreachable-prerequisite",
        );
      }),
      { numRuns: 40 },
    );
  });

  it("reports the same cycle however the skills are ordered", async () => {
    await fc.assert(
      fc.asyncProperty(
        generated.filter(({ skills }) => skills.length >= 2),
        async ({ skills }) => {
          const first = skills[0];
          const last = skills.at(-1);
          const cyclic = skills.map((s) =>
            s === first && last !== undefined
              ? { ...s, prerequisites: [...s.prerequisites, last.id] }
              : s,
          );
          const withCycle = cyclic.map((s) =>
            s === cyclic.at(-1) &&
            first !== undefined &&
            !s.prerequisites.includes(first.id)
              ? { ...s, prerequisites: [...s.prerequisites, first.id] }
              : s,
          );
          const forward = await validateCurriculum(data({ skills: withCycle }));
          const backward = await validateCurriculum(
            data({ skills: [...withCycle].reverse() }),
          );
          expect(forward.map((i) => i.message)).toEqual(
            backward.map((i) => i.message),
          );
          expect(forward.map((i) => i.code)).toEqual(["skill-cycle"]);
        },
      ),
      { numRuns: 40 },
    );
  });
});

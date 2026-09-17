import { describe, expect, it } from "vitest";
import { PSYQ_WASM_DEFAULT_CPP_FLAGS } from "./compiler.ts";
import type { MissionExample } from "./example.ts";
import { isRealMissionKind, MISSION_KINDS, MissionSchema } from "./mission.ts";
import {
  inlineTarget,
  issuesOf,
  PLACEHOLDER_COMMIT,
  PLACEHOLDER_HASH,
  realMission,
  remoteTarget,
  syntheticMission,
} from "./testing.ts";

const prediction = {
  question: "Which register carries the first argument?",
  choices: ["$v0", "$a0"],
  answer: 1,
  revealedBy: "The copy from $a0.",
};

const evidence = {
  question: "Which instruction returns the value?",
  range: { start: 1, end: 2 },
  retry: "Look for the write to $v0.",
};

const wholeFile = {
  repository: "FoxdieTeam/mgs_reversing",
  commit: PLACEHOLDER_COMMIT,
  path: "source/sample/sample.c",
  sha256: PLACEHOLDER_HASH,
} as const;

const upstreamReference = { ...wholeFile, lines: { start: 1, end: 2 } };

function issues(value: unknown) {
  return issuesOf(MissionSchema, value);
}

function issue(path: string, message: string) {
  return { path, message };
}

describe("example values", () => {
  const pointer: MissionExample = {
    caption: "p holds address 0x1000; memory there holds 42.",
    registers: [{ register: "$a0", value: 0x1000 }],
    regions: [
      {
        label: "int at p",
        address: 0x1000,
        cells: [{ offset: 0, size: 4, label: "*p", value: 42 }],
      },
    ],
  };

  it("accepts a consistent example, including a pointer between regions", () => {
    expect(
      issues(
        syntheticMission({
          example: {
            ...pointer,
            skill: "ABI.RETURN",
            regions: [
              {
                label: "struct Holder",
                address: 0x3000,
                cells: [
                  {
                    offset: 0x20,
                    size: 4,
                    label: "inner",
                    value: 0x4000,
                    pointsTo: "struct Inner",
                  },
                ],
              },
              {
                label: "struct Inner",
                address: 0x4000,
                cells: [
                  { offset: 0, size: 4, label: "x", value: 7 },
                  { offset: 4, size: 1, label: "level", value: -3 },
                  { offset: 5, size: 1, label: "count", value: 255 },
                ],
              },
            ],
          },
        }),
      ),
    ).toEqual([]);
  });

  it.each<[string, MissionExample, string, string]>([
    [
      "an unlisted skill",
      { ...pointer, skill: "MIPS.LOAD.WORD" },
      "example.skill",
      "An example's skill must be one the mission teaches or practices.",
    ],
    [
      "a repeated register",
      {
        ...pointer,
        registers: [
          { register: "$a0", value: 1 },
          { register: "$a0", value: 2 },
        ],
      },
      "example.registers",
      "Each register appears once.",
    ],
    [
      "a repeated region label",
      { ...pointer, regions: [...pointer.regions, ...pointer.regions] },
      "example.regions",
      "Each region has its own label.",
    ],
    [
      "overlapping cells",
      {
        ...pointer,
        regions: [
          {
            label: "int at p",
            address: 0x1000,
            cells: [
              { offset: 0, size: 4, label: "a", value: 1 },
              { offset: 2, size: 2, label: "b", value: 2 },
            ],
          },
        ],
      },
      "example.regions.0.cells.1",
      "Cells are listed by offset and must not overlap the cell before.",
    ],
    [
      "a value too big for its size",
      {
        ...pointer,
        regions: [
          {
            label: "byte",
            address: 0x1000,
            cells: [{ offset: 0, size: 1, label: "b", value: 256 }],
          },
        ],
      },
      "example.regions.0.cells.0.value",
      "A cell's value must fit in its size.",
    ],
    [
      "a misaligned cell",
      {
        ...pointer,
        regions: [
          {
            label: "int",
            address: 0x1001,
            cells: [{ offset: 0, size: 4, label: "i", value: 1 }],
          },
        ],
      },
      "example.regions.0.cells.0.offset",
      "A cell's address must be aligned to its size.",
    ],
    [
      "a pointer to an unknown region",
      {
        ...pointer,
        regions: [
          {
            label: "int at p",
            address: 0x1000,
            cells: [
              {
                offset: 0,
                size: 4,
                label: "next",
                value: 0x2000,
                pointsTo: "missing",
              },
            ],
          },
        ],
      },
      "example.regions.0.cells.0.pointsTo",
      "A pointer cell is 4 bytes and holds the address of a region in the example.",
    ],
    [
      "a pointer that does not hold its region's address",
      {
        ...pointer,
        regions: [
          {
            label: "int at p",
            address: 0x1000,
            cells: [
              {
                offset: 0,
                size: 4,
                label: "self",
                value: 0x2000,
                pointsTo: "int at p",
              },
            ],
          },
        ],
      },
      "example.regions.0.cells.0.pointsTo",
      "A pointer cell is 4 bytes and holds the address of a region in the example.",
    ],
  ])("rejects %s", (_name, example, path, message) => {
    expect(issues(syntheticMission({ example }))).toEqual([
      issue(path, message),
    ]);
  });

  it("rejects a register that is not an ABI name", () => {
    expect(
      issues(
        syntheticMission({
          example: { ...pointer, registers: [{ register: "$4", value: 1 }] },
        }),
      ).map(({ path }) => path),
    ).toEqual(["example.registers.0.register"]);
  });

  it("rejects an example on a mission with a remote target", () => {
    expect(issues(realMission({ example: pointer }))).toContainEqual(
      issue(
        "example",
        "Only missions with an inline target carry example values.",
      ),
    );
  });
});

describe("valid missions", () => {
  it("accepts the synthetic and real builders", () => {
    expect(issues(syntheticMission())).toEqual([]);
    expect(issues(realMission())).toEqual([]);
  });

  it("classifies mission kinds", () => {
    expect(MISSION_KINDS.filter(isRealMissionKind)).toEqual([
      "real-solved",
      "real-partial",
      "live",
    ]);
  });

  it("rejects unknown keys", () => {
    expect(issues({ ...syntheticMission(), words: [1] })).not.toEqual([]);
  });
});

describe("terms", () => {
  it("accepts unique manual entry IDs", () => {
    expect(
      issues(syntheticMission({ terms: ["glossary.register", "glossary.v0"] })),
    ).toEqual([]);
  });

  it("rejects repeated or malformed IDs", () => {
    expect(
      issues(
        syntheticMission({
          terms: ["glossary.register", "glossary.register"],
        }),
      ),
    ).toEqual([issue("terms", "Entries must be unique.")]);
    expect(issues(syntheticMission({ terms: ["Glossary.V0"] }))).toEqual([
      issue(
        "terms.0",
        "Manual entry IDs are lower-case words joined by '.' or '-'.",
      ),
    ]);
  });
});

describe("contextTypes", () => {
  it("accepts typedef names and tagged aggregates the synthetic C declares", () => {
    const mission = syntheticMission({
      contextTypes: ["struct Pair", "Slot"],
      starterSource: "struct Pair { int a; int b; };\nint f(void);\n",
    });
    mission.compiler.headers = {
      "slot.h": "typedef struct { void *data; } Slot;\n",
    };
    expect(issues(mission)).toEqual([]);
  });

  it("rejects malformed, repeated, empty, or undeclared names", () => {
    expect(issues(syntheticMission({ contextTypes: ["struct"] }))).toEqual([
      issue("contextTypes.0", "The starter and headers do not declare struct."),
    ]);
    expect(issues(syntheticMission({ contextTypes: ["enum Color"] }))).toEqual([
      issue(
        "contextTypes.0",
        "Context types are a C type name, optionally after 'struct ' or 'union '.",
      ),
    ]);
    expect(issues(syntheticMission({ contextTypes: [] }))).toEqual([
      issue("contextTypes", expect.stringMatching(/>=1/) as string),
    ]);
    expect(
      issues(
        syntheticMission({
          contextTypes: ["struct Missing", "Missing"],
          starterSource: "int f(void);\n",
        }),
      ),
    ).toEqual([
      issue(
        "contextTypes.0",
        "The starter and headers do not declare struct Missing.",
      ),
      issue(
        "contextTypes.1",
        "The starter and headers do not declare Missing.",
      ),
    ]);
  });

  it("leaves a real mission's types to the runtime probe", () => {
    expect(issues(realMission({ contextTypes: ["KCB_LIKE"] }))).toEqual([]);
  });
});

describe("source and target", () => {
  it("rejects a synthetic mission with upstream provenance or a remote target", () => {
    expect(
      issues(
        syntheticMission({
          source: realMission().source,
          target: remoteTarget(),
        }),
      ),
    ).toEqual([
      issue("source", "Synthetic missions use a synthetic source."),
      issue(
        "target",
        "Synthetic missions carry an inline target generated from their solution.",
      ),
    ]);
  });

  it("rejects a real mission without provenance", () => {
    expect(issues(realMission({ source: { kind: "synthetic" } }))).toEqual([
      issue("source", "Real missions must record their upstream provenance."),
    ]);
  });

  it("rejects a real mission whose symbol differs from its source", () => {
    expect(issues(realMission({ symbol: "other_function" }))).toEqual([
      issue("symbol", "A real mission's symbol must match its source symbol."),
    ]);
  });

  it("rejects a real mission with inline target words", () => {
    expect(issues(realMission({ target: inlineTarget() }))).toEqual([
      issue(
        "target",
        "Real missions point to a remote target and carry no inline words.",
      ),
    ]);
  });

  it("rejects a real mission with inline C in authored headers", () => {
    const mission = realMission();
    mission.compiler.headers = { "source/sample.h": "int sample;\n" };
    expect(issues(mission)).toEqual([
      issue(
        "compiler.headers",
        "Real missions load all context remotely and carry no authored headers.",
      ),
    ]);
  });

  it.each(["real-solved", "real-partial", "live"] as const)(
    "rejects a %s mission carrying a solution",
    (kind) => {
      expect(
        issues(realMission({ kind, hints: [], solution: "void f(void) {}\n" })),
      ).toEqual([
        issue("solution", "Only synthetic missions carry a solution."),
      ]);
    },
  );
});

describe("real compiler input", () => {
  it("rejects an aspsxVersion other than 2.77", () => {
    const mission = realMission();
    mission.compiler.aspsxVersion = "2.81";
    expect(issues(mission)).toEqual([
      issue(
        "compiler.aspsxVersion",
        'Real missions use aspsxVersion "2.77", the assembler of upstream\'s default build.',
      ),
    ]);
  });

  it("rejects cppFlags missing -DINTEGRAL", () => {
    const mission = realMission();
    mission.compiler.cppFlags = mission.compiler.cppFlags.filter(
      (flag) => flag !== "-DINTEGRAL",
    );
    expect(issues(mission)).toEqual([
      issue(
        "compiler.cppFlags",
        "Real missions use exactly the preprocessor flags of upstream's default build.",
      ),
    ]);
  });

  it("rejects different rawFlags and encoding", () => {
    const mission = realMission();
    mission.compiler.rawFlags = ["-O2", "-Wall"];
    mission.compiler.encoding = "utf8";
    expect(issues(mission)).toEqual([
      issue(
        "compiler.rawFlags",
        "Real missions use exactly the compiler flags of upstream's default build.",
      ),
      issue(
        "compiler.encoding",
        'Real missions use encoding "eucjp", like upstream\'s default build.',
      ),
    ]);
  });

  it("does not hold synthetic missions to upstream's build", () => {
    const mission = syntheticMission();
    mission.compiler.aspsxVersion = "2.81";
    mission.compiler.cppFlags = [...PSYQ_WASM_DEFAULT_CPP_FLAGS, "-DEXTRA"];
    expect(issues(mission)).toEqual([]);
  });
});

describe("taught skills", () => {
  const two = ["ABI.RETURN", "ABI.ARGUMENT"];

  it("rejects a normal mission that teaches two skills without an override", () => {
    expect(issues(syntheticMission({ teaches: two }))).toEqual([
      issue(
        "teaches",
        "A mission teaches at most one skill unless teachesOverride explains why.",
      ),
    ]);
  });

  it("accepts two taught skills with an override", () => {
    expect(
      issues(
        syntheticMission({
          teaches: two,
          teachesOverride: { reason: "The two skills cannot be separated." },
        }),
      ),
    ).toEqual([]);
  });

  it("rejects an override that is not needed", () => {
    expect(
      issues(syntheticMission({ teachesOverride: { reason: "Not needed." } })),
    ).toEqual([
      issue(
        "teachesOverride",
        "teachesOverride is only for missions that teach more than one skill.",
      ),
    ]);
  });

  it("rejects a synthesis mission that teaches a skill", () => {
    expect(issues(syntheticMission({ kind: "synthesis" }))).toEqual([
      issue("teaches", "Synthesis missions teach no new skill."),
    ]);
  });

  it("rejects a synthesis mission with an override, even for many skills", () => {
    expect(
      issues(
        syntheticMission({
          kind: "synthesis",
          teaches: two,
          teachesOverride: { reason: "Synthesis." },
        }),
      ),
    ).toEqual([
      issue("teaches", "Synthesis missions teach no new skill."),
      issue(
        "teachesOverride",
        "teachesOverride is only for missions that teach more than one skill.",
      ),
    ]);
  });

  it("accepts a synthesis mission that teaches nothing", () => {
    expect(
      issues(
        syntheticMission({
          kind: "synthesis",
          teaches: [],
          practices: two,
        }),
      ),
    ).toEqual([]);
  });

  it("rejects repeated skills in a list", () => {
    expect(
      issues(syntheticMission({ requires: ["ABI.RETURN", "ABI.RETURN"] })),
    ).not.toEqual([]);
  });
});

describe("completion", () => {
  it("rejects a prediction mission without a prompt", () => {
    expect(
      issues(syntheticMission({ kind: "prediction", completion: "exact" })),
    ).toEqual([
      issue(
        "prediction",
        "Prediction missions and the prediction-recorded rule need a prediction prompt.",
      ),
    ]);
  });

  it("rejects the prediction-recorded rule without a prompt", () => {
    expect(
      issues(syntheticMission({ completion: "prediction-recorded" })),
    ).toHaveLength(1);
  });

  it("accepts a prediction mission with a prompt", () => {
    expect(
      issues(
        syntheticMission({
          kind: "prediction",
          completion: "prediction-recorded",
          prediction,
        }),
      ),
    ).toEqual([]);
  });

  it("accepts the acknowledge-evidence rule with evidence inside the target", () => {
    expect(
      issues(
        syntheticMission({
          kind: "demo",
          completion: "acknowledge-evidence",
          evidence,
        }),
      ),
    ).toEqual([]);
  });

  it("rejects the acknowledge-evidence rule without evidence", () => {
    expect(
      issues(syntheticMission({ completion: "acknowledge-evidence" })),
    ).toEqual([
      issue(
        "evidence",
        "The acknowledge-evidence rule needs an evidence prompt.",
      ),
    ]);
  });

  it("rejects evidence under another completion rule", () => {
    expect(issues(syntheticMission({ evidence }))).toEqual([
      issue(
        "evidence",
        "Only the acknowledge-evidence rule uses an evidence prompt.",
      ),
    ]);
  });

  it("rejects evidence outside the target function", () => {
    expect(
      issues(
        syntheticMission({
          completion: "acknowledge-evidence",
          evidence: { ...evidence, range: { start: 1, end: 3 } },
        }),
      ),
    ).toEqual([
      issue(
        "evidence.range",
        "The evidence must stay inside the target function.",
      ),
    ]);
  });

  it("rejects evidence on a remote target", () => {
    expect(
      issues(realMission({ completion: "acknowledge-evidence", evidence })),
    ).toContainEqual(
      issue(
        "evidence",
        "Only missions with an inline target name evidence words.",
      ),
    );
  });

  it("rejects a demonstration mission without a completion rule", () => {
    const { completion, ...mission } = syntheticMission({ kind: "demo" });
    expect(completion).toBe("exact");
    expect(issues(mission)).toEqual([
      expect.objectContaining({ path: "completion" }),
    ]);
  });
});

describe("hints", () => {
  it("requires strictly increasing stages", () => {
    expect(
      issues(
        syntheticMission({
          hints: [
            { stage: 2, text: "Second." },
            { stage: 2, text: "Again." },
          ],
        }),
      ),
    ).toEqual([issue("hints.1.stage", "Hint stages must strictly increase.")]);
  });

  it("keeps highlights inside the target", () => {
    expect(
      issues(
        syntheticMission({
          hints: [
            { stage: 2, text: "Look here.", highlight: { start: 1, end: 3 } },
          ],
        }),
      ),
    ).toEqual([
      issue(
        "hints.0.highlight",
        "A highlight must stay inside the target function.",
      ),
    ]);
    expect(
      issues(
        realMission({
          hints: [
            { stage: 2, text: "Look here.", highlight: { start: 0, end: 4 } },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("keeps annotations inside an inline target", () => {
    expect(
      issues(
        syntheticMission({
          annotations: [
            {
              range: { start: 0, end: 1 },
              text: "The return.",
              manualEntry: "abi.return-values",
            },
            { range: { start: 1, end: 3 }, text: "Past the end." },
          ],
        }),
      ),
    ).toEqual([
      issue(
        "annotations.1.range",
        "An annotation must stay inside the target function.",
      ),
    ]);
  });

  it("ties an annotation only to a skill the mission teaches or practices", () => {
    const message =
      "An annotation's skill must be one the mission teaches or practices.";
    const found = issues(
      syntheticMission({
        teaches: ["ABI.RETURN"],
        practices: ["ABI.ARGUMENT"],
        annotations: [
          { range: { start: 0, end: 1 }, text: "Taught.", skill: "ABI.RETURN" },
          {
            range: { start: 0, end: 1 },
            text: "Practiced.",
            skill: "ABI.ARGUMENT",
          },
          {
            range: { start: 0, end: 1 },
            text: "Unlisted.",
            skill: "MIPS.LOAD.WORD",
          },
        ],
      }),
    );

    expect(found).toContainEqual(issue("annotations.2.skill", message));
    expect(found).not.toContainEqual(issue("annotations.0.skill", message));
    expect(found).not.toContainEqual(issue("annotations.1.skill", message));
  });

  it("rejects annotations on a mission with a remote target", () => {
    expect(
      issues(
        realMission({
          annotations: [{ range: { start: 0, end: 1 }, text: "A note." }],
        }),
      ),
    ).toEqual([
      issue(
        "annotations",
        "Only missions with an inline target annotate target words.",
      ),
    ]);
  });

  it("rejects a real-solved reveal on a stage other than 5 or 9", () => {
    expect(
      issues(
        realMission({
          hints: [{ stage: 3, text: "Too early.", reveal: upstreamReference }],
        }),
      ),
    ).toEqual([
      issue(
        "hints.0.reveal",
        "Only real-solved missions reveal upstream C, and only at stages 5 and 9.",
      ),
    ]);
  });

  it.each(["real-partial", "training"] as const)(
    "rejects a reveal on a %s mission",
    (kind) => {
      const base = kind === "training" ? syntheticMission() : realMission();
      expect(
        issues({
          ...base,
          kind,
          hints: [
            {
              stage: 5,
              text: "A reveal.",
              reveal: upstreamReference,
              ...(kind === "training" ? {} : { verified: true }),
            },
          ],
        }),
      ).toEqual([
        issue(
          "hints.0.reveal",
          "Only real-solved missions reveal upstream C, and only at stages 5 and 9.",
        ),
      ]);
    },
  );

  it("rejects a stage 9 reveal from psyq_sdk", () => {
    expect(
      issues(
        realMission({
          hints: [
            {
              stage: 9,
              text: "Wrong repository.",
              reveal: {
                ...upstreamReference,
                repository: "FoxdieTeam/psyq_sdk",
              },
            },
          ],
        }),
      ),
    ).toEqual([
      issue(
        "hints.0.reveal.repository",
        "A stage 9 reveal shows the function's own source from mgs_reversing, never psyq_sdk.",
      ),
    ]);
  });

  it("rejects a reveal without a line span", () => {
    expect(
      issues(
        realMission({
          hints: [{ stage: 5, text: "Whole file.", reveal: wholeFile }],
        }),
      ),
    ).toEqual([
      issue(
        "hints.0.reveal.lines",
        "A revealed upstream file shows only its referenced line span.",
      ),
    ]);
  });

  it("rejects a real-solved stage 9 hint without a reveal", () => {
    expect(
      issues(realMission({ hints: [{ stage: 9, text: "No reveal." }] })),
    ).toEqual([
      issue(
        "hints.0.reveal",
        "A real-solved stage 9 hint reveals the known solution's line span.",
      ),
    ]);
  });

  it("rejects a live mission with a stage 9 hint", () => {
    expect(
      issues(
        realMission({
          kind: "live",
          hints: [{ stage: 9, text: "There is no answer.", verified: false }],
        }),
      ),
    ).toEqual([
      issue(
        "hints.0.stage",
        "Live missions have no known solution, so they have no stage 9 hint.",
      ),
    ]);
  });

  it("rejects a solution reveal on a real mission or before stage 9", () => {
    expect(
      issues(
        realMission({
          kind: "real-partial",
          hints: [
            {
              stage: 4,
              text: "Solution.",
              revealSolution: true,
              verified: true,
            },
          ],
        }),
      ),
    ).toEqual([
      issue(
        "hints.0.revealSolution",
        "Only a synthetic mission's stage 9 hint reveals its solution.",
      ),
    ]);
    expect(
      issues(
        syntheticMission({
          hints: [{ stage: 8, text: "Solution.", revealSolution: true }],
        }),
      ),
    ).toHaveLength(1);
  });

  it("rejects a synthetic stage 9 hint without a solution", () => {
    const mission = syntheticMission();
    delete mission.solution;
    expect(issues(mission)).toEqual([
      issue(
        "solution",
        "A synthetic mission with a stage 9 hint must include its solution.",
      ),
    ]);
  });

  it("rejects a synthetic stage 9 hint that does not reveal the solution", () => {
    expect(
      issues(syntheticMission({ hints: [{ stage: 9, text: "Hidden." }] })),
    ).toEqual([
      issue(
        "hints.0.revealSolution",
        "A synthetic stage 9 hint reveals the mission solution.",
      ),
    ]);
  });

  it.each(["real-partial", "live"] as const)(
    "requires each %s hint to say whether it is verified",
    (kind) => {
      expect(
        issues(
          realMission({
            kind,
            hints: [
              { stage: 1, text: "A known fact.", verified: true },
              { stage: 2, text: "A guess.", verified: false },
              { stage: 3, text: "Unmarked." },
            ],
          }),
        ),
      ).toEqual([
        issue(
          "hints.2.verified",
          "A real-partial or live hint says whether it is verified or a hypothesis.",
        ),
      ]);
    },
  );

  it("rejects a verified mark on a synthetic or real-solved hint", () => {
    const message =
      "Only real-partial and live hints are marked verified or hypothesis.";
    expect(
      issues(
        syntheticMission({
          hints: [{ stage: 1, text: "Marked.", verified: true }],
        }),
      ),
    ).toContainEqual(issue("hints.0.verified", message));
    expect(
      issues(
        realMission({
          hints: [{ stage: 1, text: "Marked.", verified: false }],
        }),
      ),
    ).toEqual([issue("hints.0.verified", message)]);
  });

  it("accepts a synthetic mission with no hints and no solution", () => {
    const mission = syntheticMission({ hints: [] });
    delete mission.solution;
    expect(issues(mission)).toEqual([]);
  });
});

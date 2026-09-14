import { describe, expect, it } from "vitest";
import { PSYQ_WASM_DEFAULT_CPP_FLAGS } from "./compiler.ts";
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
          hints: [{ stage: 5, text: "A reveal.", reveal: upstreamReference }],
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
          hints: [{ stage: 9, text: "There is no answer." }],
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
          hints: [{ stage: 4, text: "Solution.", revealSolution: true }],
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

  it("accepts a synthetic mission with no hints and no solution", () => {
    const mission = syntheticMission({ hints: [] });
    delete mission.solution;
    expect(issues(mission)).toEqual([]);
  });
});

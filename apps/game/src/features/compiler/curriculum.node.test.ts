import { missions } from "@osp/curriculum";
import { teachingHypotheses, type MatchResult } from "@osp/matching-core";
import type { Mission } from "@osp/mission-schema";
import { assemble } from "psyq-asm";
import { createCompiler } from "psyq-wasm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  missionMatchTarget,
  missionResultFrom,
} from "../workspace/missionResult";
import { PSYQ_ASM_VERSION } from "./browserToolchain";
import { createToolchainService } from "./toolchainService";
import type { ToolchainService } from "./types";

// Every mission here is synthetic and OSP-authored. Real missions load their
// targets from upstream, and a separate suite checks them from local checkouts.

const syntheticMissions = missions.filter(
  (mission) => mission.source.kind === "synthetic",
);

const exactMissions = syntheticMissions.filter(
  (mission) => mission.completion === "exact",
);

describe("shipped missions with the real toolchain", () => {
  let service: ToolchainService;

  beforeAll(async () => {
    service = await createToolchainService({
      createCompiler: () => createCompiler(),
      assemble,
      psyqAsmVersion: PSYQ_ASM_VERSION,
    });
  }, 30_000);

  afterAll(() => {
    service.dispose();
  });

  async function compare(
    mission: Mission,
    source: string,
  ): Promise<MatchResult> {
    const target = missionMatchTarget(mission);
    if (target === undefined) {
      throw new Error(`Mission ${mission.id} has no inline target.`);
    }
    const { compiler } = mission;
    const outcome = await service.build({
      filename: compiler.filename,
      source,
      headers: compiler.headers,
      cppFlags: compiler.cppFlags,
      rawFlags: compiler.rawFlags,
      gpSize: compiler.gpSize,
      aspsxVersion: compiler.aspsxVersion,
      encoding: compiler.encoding,
    });
    const result = missionResultFrom(
      { missionId: mission.id, buildId: 1, sourceSha256: "a".repeat(64) },
      outcome,
      mission.symbol,
      target,
    );
    if (result.kind !== "matched") {
      throw new Error(`Mission ${mission.id} gave ${result.kind}.`);
    }
    return result.result;
  }

  it.each(syntheticMissions.map((mission) => [mission.id, mission] as const))(
    "mission %s: the solution matches its target exactly",
    async (_, mission) => {
      if (mission.solution === undefined) {
        throw new Error(`Mission ${mission.id} has no solution.`);
      }
      expect((await compare(mission, mission.solution)).exact).toBe(true);
    },
  );

  it.each(exactMissions.map((mission) => [mission.id, mission] as const))(
    "mission %s: the starting source builds the function and does not match",
    async (_, mission) => {
      const result = await compare(mission, mission.starterSource);
      expect(result.exact).toBe(false);
      expect(result.mismatches.length).toBeGreaterThan(0);
    },
  );

  it("mission 011: the starting source differs only in load signedness", async () => {
    const mission = missions.find((entry) => entry.id === "011");
    if (mission === undefined) {
      throw new Error("The curriculum has no mission 011.");
    }

    const result = await compare(mission, mission.starterSource);

    expect(result.mismatches.map((mismatch) => mismatch.kind)).toEqual([
      "LOAD_SIGNEDNESS",
    ]);
    expect(
      teachingHypotheses(result).map((hypothesis) => hypothesis.kind),
    ).toContain("LIKELY_SIGNEDNESS");
  });

  it("mission 007: returning the pointer instead of its value suggests a missing dereference", async () => {
    const mission = missions.find((entry) => entry.id === "007");
    if (mission?.solution === undefined) {
      throw new Error("The curriculum has no mission 007 with a solution.");
    }
    const addressReturned = mission.solution.replace(
      /return \*(\w+);/,
      "return (int)$1;",
    );
    expect(addressReturned).not.toBe(mission.solution);

    const hypotheses = teachingHypotheses(
      await compare(mission, addressReturned),
    );

    expect(hypotheses.map((hypothesis) => hypothesis.kind)).toContain(
      "LIKELY_EXPRESSION_SHAPE",
    );
  });

  it("mission 023: reading the wrong variable assembles to the same words and still fails", async () => {
    const mission = missions.find((entry) => entry.id === "023");
    if (mission?.solution === undefined) {
      throw new Error("The curriculum has no mission 023 with a solution.");
    }
    // A second variable of the same type, read in place of the first. Nothing
    // outside the relocated fields differs, so the words are identical and
    // only the symbol each row refers to tells the two apart.
    const otherVariable = `int other;\n${mission.solution.replace(
      "return level;",
      "return other;",
    )}`;
    expect(otherVariable).not.toBe(mission.solution);

    const result = await compare(mission, otherVariable);

    expect(result.exact).toBe(false);
    // One per relocated field: the address is built in two halves, and each
    // half names the variable separately.
    expect(result.mismatches.map((mismatch) => mismatch.kind)).toEqual([
      "RELOCATION_TARGET",
      "RELOCATION_TARGET",
    ]);
  });

  it("mission 034: a correct program with the test the other way round reports its two halves", async () => {
    const mission = missions.find((entry) => entry.id === "034");
    if (mission === undefined) {
      throw new Error("The curriculum has no mission 034.");
    }
    // The starter returns the right value for every input. Inverting the
    // test also swaps the two paths, and the comparison reports exactly
    // those two things. These are the first shipped mission that can reach
    // either kind, so what they say is pinned here.
    const result = await compare(mission, mission.starterSource);

    expect(result.exact).toBe(false);
    expect(result.mismatches.map((mismatch) => mismatch.kind)).toEqual([
      "BRANCH_CONDITION",
      "INSTRUCTION_ORDER",
    ]);
    expect(result.mismatches[0]?.evidence.join(" ")).toContain(
      "The branch conditions differ.",
    );
  });

  // Each loop-phase starter is one contained step from its target, because a
  // structurally different listing cascades into findings that are only
  // consequences. The hints read these findings, so what they are is pinned.
  it.each([
    ["036", ["BRANCH_CONDITION"]],
    // The guard is the one row a do/while lacks.
    ["037", ["MISSING_INSTRUCTION"]],
    // With the body swapped, nothing lands in the back edge's slot that the
    // exit has to take back: the peeled add and the undo both go.
    ["038", ["MISSING_INSTRUCTION", "DELAY_SLOT"]],
    // The counter's step and the pointer's step, 4 bytes apart.
    ["039", ["IMMEDIATE", "IMMEDIATE"]],
    ["040", ["BRANCH_TARGET", "DELAY_SLOT", "INSTRUCTION_ORDER"]],
    // The missing guard moves every row below it, so the jump's destination
    // differs on both sides.
    ["041", ["MISSING_INSTRUCTION", "RELOCATION_TARGET", "RELOCATION_TARGET"]],
  ])(
    "mission %s: the starting source reports the step it is missing",
    async (id, kinds) => {
      const mission = missions.find((entry) => entry.id === id);
      if (mission === undefined) {
        throw new Error(`The curriculum has no mission ${id}.`);
      }
      const result = await compare(mission, mission.starterSource);

      expect(result.mismatches.map((mismatch) => mismatch.kind)).toEqual(kinds);
    },
  );

  // The functions-phase starters, pinned for the same reason. A call that
  // moves by a row is reported twice, which only 048's hints rely on.
  it.each([
    ["042", ["CALL_TARGET"]],
    ["043", ["MEMORY_OFFSET"]],
    ["044", ["REGISTER"]],
    // Which argument is copied into $s0 in the call's delay slot.
    ["045", ["REGISTER"]],
    ["047", ["OPCODE"]],
    ["048", ["MISSING_INSTRUCTION", "CALL_TARGET", "RELOCATION_TARGET"]],
    ["049", ["OPCODE"]],
    ["050", ["MISSING_INSTRUCTION", "MISSING_INSTRUCTION"]],
  ])(
    "mission %s: the starting source reports its one difference",
    async (id, kinds) => {
      const mission = missions.find((entry) => entry.id === id);
      if (mission === undefined) {
        throw new Error(`The curriculum has no mission ${id}.`);
      }
      const result = await compare(mission, mission.starterSource);

      expect(result.mismatches.map((mismatch) => mismatch.kind)).toEqual(kinds);
    },
  );

  it("mission 039: the two steps differ by the size of an int", async () => {
    const mission = missions.find((entry) => entry.id === "039");
    if (mission === undefined) {
      throw new Error("The curriculum has no mission 039.");
    }
    const result = await compare(mission, mission.starterSource);

    expect(result.mismatches.map((m) => m.evidence.join(" "))).toEqual([
      "Immediate values differ. Target: addiu $v1,$v1,0x1; yours: addiu $v1,$v1,0x2.",
      "Immediate values differ. Target: addiu $a0,$a0,0x4; yours: addiu $a0,$a0,0x8.",
    ]);
  });
});

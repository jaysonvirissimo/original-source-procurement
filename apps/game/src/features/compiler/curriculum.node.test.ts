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

// Every mission here is synthetic and OSP-authored.

const exactMissions = missions.filter(
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

  it.each(missions.map((mission) => [mission.id, mission] as const))(
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
});

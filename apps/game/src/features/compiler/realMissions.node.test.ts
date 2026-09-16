import { missions } from "@osp/curriculum";
import type { Mission } from "@osp/mission-schema";
import { assemble } from "psyq-asm";
import { createCompiler } from "psyq-wasm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  checkoutsFromEnvironment,
  createLocalCheckoutUpstream,
} from "../../test/localCheckoutUpstream.node";
import type { UpstreamService } from "../upstream/types";
import { loadMissionContext } from "../workspace/missionContext";
import { missionResultFrom } from "../workspace/missionResult";
import { PSYQ_ASM_VERSION } from "./browserToolchain";
import { createToolchainService } from "./toolchainService";
import type { ToolchainService } from "./types";

// Upstream content is read at run time from local checkouts named by
// OSP_MGS_REVERSING_DIR and OSP_PSYQ_SDK_DIR, and this suite is skipped when
// they are unset. Assertions and messages never include words or C.

const checkouts = checkoutsFromEnvironment();

const realMissions = missions.filter(
  (mission) => mission.kind === "real-solved",
);

/** The starter's preprocessor lines, which a player keeps above the function. */
function starterPreamble(mission: Mission): string {
  return mission.starterSource
    .split("\n")
    .filter((line) => line.startsWith("#"))
    .map((line) => `${line}\n`)
    .join("");
}

describe.skipIf(checkouts === undefined)(
  "shipped real missions from local checkouts",
  () => {
    let service: ToolchainService;
    let upstream: UpstreamService;

    beforeAll(async () => {
      if (checkouts === undefined) {
        throw new Error("Local upstream checkouts are not configured.");
      }
      upstream = createLocalCheckoutUpstream(checkouts);
      service = await createToolchainService({
        createCompiler: () => createCompiler(),
        assemble,
        psyqAsmVersion: PSYQ_ASM_VERSION,
      });
    }, 30_000);

    afterAll(() => {
      service.dispose();
    });

    it("ships at least one real solved mission", () => {
      expect(realMissions.length).toBeGreaterThan(0);
    });

    describe.each(
      realMissions.map((mission) => [mission.id, mission] as const),
    )("%s", (_id, mission) => {
      async function compare(source: string) {
        const context = await loadMissionContext(mission, upstream);
        if (context.kind !== "ready") {
          throw new Error(`Context did not load: ${context.kind}.`);
        }
        const outcome = await service.build({ ...context.input, source });
        return missionResultFrom(
          { missionId: mission.id, buildId: 1, sourceSha256: "a".repeat(64) },
          outcome,
          mission.symbol,
          context.target,
        );
      }

      async function reveal(stage: number): Promise<string> {
        const reference = mission.hints.find(
          (hint) => hint.stage === stage,
        )?.reveal;
        if (reference === undefined) {
          throw new Error(`Stage ${String(stage)} reveals nothing.`);
        }
        const outcome = await upstream.loadC(reference);
        if (outcome.kind !== "loaded") {
          throw new Error(`Stage ${String(stage)} did not load.`);
        }
        return outcome.value;
      }

      it("reaches an exact match from the starter's includes and the stage 9 reveal", async () => {
        const result = await compare(
          `${starterPreamble(mission)}\n${await reveal(9)}`,
        );

        expect(result.kind).toBe("matched");
        expect(result.kind === "matched" && result.result.exact).toBe(true);
      }, 60_000);

      it("builds the starter, which defines the function and does not match", async () => {
        const result = await compare(mission.starterSource);

        expect(result.kind).toBe("matched");
        expect(result.kind === "matched" && result.result.exact).toBe(false);
      }, 60_000);

      it("reveals a non-empty line span at stages 5 and 9", async () => {
        expect((await reveal(5)).trim()).not.toBe("");
        expect((await reveal(9)).includes(mission.symbol)).toBe(true);
      }, 60_000);
    });
  },
);

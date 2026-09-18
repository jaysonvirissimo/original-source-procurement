import { extractFunction } from "@osp/matching-core";
import { MissionSchema } from "@osp/mission-schema";
import { assemble } from "psyq-asm";
import { createCompiler } from "psyq-wasm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  FIELD_HEADER,
  FIELD_SOURCE,
  FIELD_STARTER,
  FIELD_SYMBOL,
  FIELD_WORDS,
  fieldMission,
  fieldTargetText,
} from "../../test/fieldFixture";
import { extractDwWords } from "../upstream/content";
import { missionResultFrom } from "../workspace/missionResult";
import { PSYQ_ASM_VERSION } from "./browserToolchain";
import { createToolchainService } from "./toolchainService";
import type { ToolchainService } from "./types";

// The browser-test field mission is OSP-authored. Its committed words must
// stay what its source compiles to with the pinned toolchain.

describe("the browser-test field mission", () => {
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

  async function build(source: string) {
    const mission = await fieldMission();
    const { compiler } = mission;
    return service.build({
      filename: compiler.filename,
      source,
      headers: {
        "psyq/include/osp_pair.h": FIELD_HEADER.replaceAll("\r\n", "\n"),
      },
      cppFlags: compiler.cppFlags,
      rawFlags: compiler.rawFlags,
      gpSize: compiler.gpSize,
      aspsxVersion: compiler.aspsxVersion,
      encoding: compiler.encoding,
    });
  }

  it("is a valid real mission", async () => {
    expect(MissionSchema.safeParse(await fieldMission()).success).toBe(true);
  });

  it("has the words its source compiles to", async () => {
    const outcome = await build(FIELD_SOURCE);
    if (outcome.kind !== "success") {
      throw new Error(`The fixture source gave ${outcome.kind}.`);
    }
    const words = extractFunction(outcome.object, FIELD_SYMBOL)?.words.map(
      (entry) => entry.word,
    );
    expect(words).toEqual(FIELD_WORDS);
    expect(extractDwWords(fieldTargetText())).toEqual(FIELD_WORDS);
  });

  it("matches exactly from its source and not from its starter", async () => {
    const target = { kind: "linked", words: FIELD_WORDS, calls: [] } as const;
    const request = { missionId: "FX1", buildId: 1, sourceSha256: "" };
    const exact = missionResultFrom(
      request,
      await build(FIELD_SOURCE),
      FIELD_SYMBOL,
      target,
    );
    const starter = missionResultFrom(
      request,
      await build(FIELD_STARTER),
      FIELD_SYMBOL,
      target,
    );

    expect(exact.kind === "matched" && exact.result.exact).toBe(true);
    expect(starter.kind === "matched" && starter.result.exact).toBe(false);
  });
});

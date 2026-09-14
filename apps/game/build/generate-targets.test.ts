import { missions } from "@osp/curriculum";
import { missionDrafts, type MissionDraft } from "@osp/curriculum/drafts";
import { sha256Hex, wordsSha256 } from "@osp/curriculum/hash";
import type { InlineTarget } from "@osp/mission-schema";
import {
  PLACEHOLDER_COMMIT,
  PLACEHOLDER_HASH,
} from "@osp/mission-schema/testing";
import { assemble } from "psyq-asm";
import { createCompiler } from "psyq-wasm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PSYQ_ASM_VERSION } from "../src/features/compiler/browserToolchain.ts";
import { createToolchainService } from "../src/features/compiler/toolchainService.ts";
import type {
  AssembledObject,
  BuildOutcome,
  ToolchainService,
} from "../src/features/compiler/types.ts";
import { assembledObject, fakeToolchain } from "../src/test/fakeToolchain.ts";
import {
  generateTarget,
  renderTargetModule,
  sameGeneratedTarget,
  targetModulePath,
} from "./generate-targets.ts";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";

// OSP-authored draft; its words come from the injected toolchain.
function draft(overrides: Partial<MissionDraft> = {}): MissionDraft {
  const [first] = missionDrafts;
  if (first === undefined) {
    throw new Error("The curriculum has no mission drafts.");
  }
  return {
    ...first,
    symbol: "f",
    solution: "int f(void) { return 1; }\n",
    ...overrides,
  };
}

function success(object: AssembledObject): BuildOutcome {
  return { kind: "success", object, compilerText: "", diagnostics: [] };
}

describe("generateTarget with an injected toolchain", () => {
  it("records words, provenance, toolchain, and hashes", async () => {
    const service = fakeToolchain(success(assembledObject([0x03e00008, 0])));

    const target = await generateTarget(service, draft(), COMMIT);

    expect(target).toEqual({
      kind: "inline",
      words: [0x03e00008, 0],
      relocations: [],
      provenance: [{ kind: "instruction" }, { kind: "instruction" }],
      toolchain: {
        ospCommit: COMMIT,
        psyqWasmVersion: "1.0.0",
        compilerBuildId: "compiler-build",
        preprocessorBuildId: "preprocessor-build",
        psyqAsmVersion: "0.2.0",
      },
      solutionSha256: await sha256Hex("int f(void) { return 1; }\n"),
      wordsSha256: await wordsSha256([0x03e00008, 0]),
    });
    expect(service.build).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "int f(void) { return 1; }\n",
        gpSize: 0,
        aspsxVersion: "2.77",
      }),
    );
  });

  it("keeps macros, notes, and structured relocation targets", async () => {
    const base = assembledObject([0x3c020000, 0x8c420000, 0]);
    const [text] = base.sections;
    if (text === undefined) {
      throw new Error("The fixture object has no .text section.");
    }
    const object: AssembledObject = {
      ...base,
      sections: [
        {
          ...text,
          provenance: [
            { line: 1, kind: "macro", macro: "lw" },
            { line: 1, kind: "macro", macro: "lw" },
            { line: 2, kind: "branch-delay-nop", note: "delay slot" },
          ],
          relocations: [
            {
              offset: 0,
              kind: "HI16",
              fieldMask: 0xffff,
              fieldValue: 0,
              target: { kind: "symbol", name: "g", addend: 4 },
            },
            {
              offset: 4,
              kind: "LO16",
              fieldMask: 0xffff,
              fieldValue: 0,
              target: { kind: "section", section: ".data", offset: 8 },
            },
            {
              offset: 8,
              kind: "LO16",
              fieldMask: 0xffff,
              fieldValue: 0,
              target: {
                kind: "section",
                section: ".data",
                offset: 12,
                label: "table",
              },
            },
          ],
        },
      ],
    };

    const target = await generateTarget(
      fakeToolchain(success(object)),
      draft(),
      COMMIT,
    );

    expect(target.provenance).toEqual([
      { kind: "macro", macro: "lw" },
      { kind: "macro", macro: "lw" },
      { kind: "branch-delay-nop", note: "delay slot" },
    ]);
    expect(target.relocations.map((entry) => entry.target)).toEqual([
      { kind: "symbol", name: "g", addend: 4 },
      { kind: "section", section: ".data", offset: 8 },
      { kind: "section", section: ".data", offset: 12, label: "table" },
    ]);
  });

  it("rejects a draft without a solution", async () => {
    const withoutSolution: MissionDraft = { ...draft() };
    delete withoutSolution.solution;

    await expect(
      generateTarget(fakeToolchain(), withoutSolution, COMMIT),
    ).rejects.toThrow("has no solution");
  });

  it("rejects a draft with remote headers", async () => {
    const withRemote = draft();
    const service = fakeToolchain();

    await expect(
      generateTarget(
        service,
        {
          ...withRemote,
          compiler: {
            ...withRemote.compiler,
            remoteHeaders: {
              "source/a.h": {
                repository: "FoxdieTeam/mgs_reversing",
                commit: PLACEHOLDER_COMMIT,
                path: "source/a.h",
                sha256: PLACEHOLDER_HASH,
              },
            },
          },
        },
        COMMIT,
      ),
    ).rejects.toThrow("remote headers");
    expect(service.build).not.toHaveBeenCalled();
  });

  it("rejects a solution that does not build", async () => {
    await expect(
      generateTarget(
        fakeToolchain({ kind: "compiler-failure", diagnostics: [] }),
        draft(),
        COMMIT,
      ),
    ).rejects.toThrow("did not build (compiler-failure)");
  });

  it("rejects a solution without the mission's function", async () => {
    await expect(
      generateTarget(
        fakeToolchain(success(assembledObject([0]))),
        draft({ symbol: "missing" }),
        COMMIT,
      ),
    ).rejects.toThrow("defines no function missing");
  });

  it("rejects a word without provenance", async () => {
    const base = assembledObject([0]);
    const [text] = base.sections;
    if (text === undefined) {
      throw new Error("The fixture object has no .text section.");
    }
    const object: AssembledObject = {
      ...base,
      sections: [{ ...text, provenance: [] }],
    };

    await expect(
      generateTarget(fakeToolchain(success(object)), draft(), COMMIT),
    ).rejects.toThrow("word 0 has no provenance");
  });
});

describe("target modules", () => {
  function target(overrides: Partial<InlineTarget> = {}): InlineTarget {
    return {
      kind: "inline",
      words: [1],
      relocations: [],
      provenance: [{ kind: "instruction" }],
      toolchain: {
        ospCommit: COMMIT,
        psyqWasmVersion: "1.0.0",
        compilerBuildId: "c",
        preprocessorBuildId: "p",
        psyqAsmVersion: "0.2.0",
      },
      solutionSha256: PLACEHOLDER_HASH,
      wordsSha256: PLACEHOLDER_HASH,
      ...overrides,
    };
  }

  it("treats targets that differ only in their OSP commit as the same", () => {
    const moved = target({
      toolchain: { ...target().toolchain, ospCommit: PLACEHOLDER_COMMIT },
    });

    expect(sameGeneratedTarget(target(), moved)).toBe(true);
    expect(sameGeneratedTarget(target(), target({ words: [2] }))).toBe(false);
  });

  it("names each mission's module and renders its source", () => {
    expect(targetModulePath("003")).toBe(
      "packages/curriculum/src/missions/targets/003.ts",
    );
    const source = renderTargetModule(target());
    expect(source).toContain("Do not edit.");
    expect(source).toContain(
      `export const target: InlineTarget = ${JSON.stringify(target())};`,
    );
  });
});

describe("committed targets with the real toolchain", () => {
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

  it.each(missionDrafts.map((entry) => [entry.id, entry] as const))(
    "regenerates mission %s's target identically",
    async (_id, entry) => {
      const committed = missions.find((mission) => mission.id === entry.id);
      if (committed?.target.kind !== "inline") {
        throw new Error(`Mission ${entry.id} has no inline target.`);
      }

      const regenerated = await generateTarget(service, entry, COMMIT);

      expect(sameGeneratedTarget(regenerated, committed.target)).toBe(true);
    },
  );
});

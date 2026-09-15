import { PSYQ_WASM_DEFAULT_CPP_FLAGS } from "@osp/mission-schema";
import { assemble } from "psyq-asm";
import { createCompiler } from "psyq-wasm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PSYQ_ASM_VERSION } from "./browserToolchain";
import { diagnosticGuidance, likelyLine } from "./diagnosticGuidance";
import { createToolchainService } from "./toolchainService";
import type { CompilerDiagnostic, ToolchainService } from "./types";

// Every C source in this file is OSP-authored.

describe("guidance for real compiler diagnostics", () => {
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

  async function diagnostics(
    source: string,
  ): Promise<readonly CompilerDiagnostic[]> {
    const outcome = await service.build({
      filename: "mission.c",
      source,
      headers: {},
      cppFlags: PSYQ_WASM_DEFAULT_CPP_FLAGS,
      rawFlags: ["-O2", "-g0", "-Wall"],
      gpSize: 0,
      aspsxVersion: "2.77",
      encoding: "utf8",
    });
    return outcome.kind === "success" || outcome.kind === "compiler-failure"
      ? outcome.diagnostics
      : [];
  }

  it("points a missing semicolon at the statement before the reported line", async () => {
    const [first] = await diagnostics(
      "void f(int *p, int v)\n{\n    *p = v\n}\n",
    );

    if (first === undefined) {
      throw new Error("Expected a diagnostic for the missing semicolon.");
    }
    expect(diagnosticGuidance(first)).toMatch(/missing semicolon/);
    expect(likelyLine(first)).toBe(3);
  });

  it.each([
    [
      "a missing closing brace",
      "int f(int a)\n{\n    return a;\n",
      /closing brace/,
    ],
    [
      "an undeclared name",
      "int f(int a)\n{\n    return b;\n}\n",
      /not declared/,
    ],
    [
      "an undeclared function",
      "int f(int a)\n{\n    return g(a);\n}\n",
      /declaration of g/,
    ],
    [
      "a structure returned as an int",
      "struct S { int x; };\nint f(struct S s)\n{\n    return s;\n}\n",
      /return type/,
    ],
    [
      "a pointer returned as an int",
      "int f(int *p)\n{\n    return p;\n}\n",
      /pointer points to/,
    ],
  ])("guides %s", async (_name, source, guidance) => {
    const guided = (await diagnostics(source)).flatMap((diagnostic) => {
      const text = diagnosticGuidance(diagnostic);
      return text === undefined ? [] : [text];
    });

    expect(guided.some((text) => guidance.test(text))).toBe(true);
  });
});

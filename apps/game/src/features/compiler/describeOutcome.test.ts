import { describe, expect, it } from "vitest";
import { assembledObject } from "../../test/fakeToolchain";
import {
  describeOutcome,
  formatDiagnostic,
  formatTextSection,
} from "./describeOutcome";

describe("formatDiagnostic", () => {
  it("prefixes the location when one is known", () => {
    expect(
      formatDiagnostic({
        severity: "error",
        file: "check.c",
        line: 3,
        column: 9,
        message: "parse error",
      }),
    ).toBe("check.c:3:9: error: parse error");
  });

  it("omits a missing location", () => {
    expect(
      formatDiagnostic({ severity: "warning", message: "no newline" }),
    ).toBe("warning: no newline");
  });
});

describe("formatTextSection", () => {
  it("lists offsets, words, and instructions", () => {
    expect(
      formatTextSection(assembledObject([0x03e00008, 0x24820005])),
    ).toEqual(["0000  03e00008  jr $ra", "0004  24820005  addiu $v0,$a0,0x5"]);
  });

  it("lists nothing for an object without a text section", () => {
    expect(formatTextSection({ ...assembledObject([]), sections: [] })).toEqual(
      [],
    );
  });
});

describe("describeOutcome", () => {
  it("summarizes a success with its listing and compiler diagnostics", () => {
    expect(
      describeOutcome({
        kind: "success",
        object: assembledObject([0x03e00008, 0x24820005]),
        compilerText: "",
        diagnostics: [{ severity: "warning", message: "unused" }],
      }),
    ).toEqual({
      tone: "success",
      summary: "Compiled and assembled 2 words.",
      diagnostics: ["warning: unused"],
      listing: ["0000  03e00008  jr $ra", "0004  24820005  addiu $v0,$a0,0x5"],
    });
  });

  it("uses the singular for one word", () => {
    expect(
      describeOutcome({
        kind: "success",
        object: assembledObject([0]),
        compilerText: "",
        diagnostics: [],
      }).summary,
    ).toBe("Compiled and assembled 1 word.");
  });

  it("describes a compiler failure", () => {
    expect(
      describeOutcome({
        kind: "compiler-failure",
        diagnostics: [
          {
            severity: "error",
            file: "check.c",
            line: 1,
            message: "parse error",
          },
        ],
      }),
    ).toEqual({
      tone: "error",
      summary: "The compiler reported errors.",
      diagnostics: ["check.c:1: error: parse error"],
      listing: [],
    });
  });

  it("presents an assembler failure as a toolchain defect", () => {
    const description = describeOutcome({
      kind: "assembler-failure",
      compilerText: "",
      diagnostics: [
        {
          severity: "error",
          file: "check.s",
          line: 4,
          code: "unknown-mnemonic",
          message: "unknown mnemonic",
        },
      ],
    });

    expect(description.summary).toMatch(/^Toolchain error:/);
    expect(description.summary).toContain("not in the source");
    expect(description.diagnostics).toEqual([
      "check.s:4: error: unknown mnemonic",
    ]);
  });

  it.each([
    [{ kind: "cancelled" } as const, "neutral", "Check cancelled."],
    [
      { kind: "timeout", timeoutMs: 20000 } as const,
      "warning",
      "The compile ran longer than 20 seconds and was stopped.",
    ],
    [
      { kind: "infrastructure-failure", message: "worker crashed" } as const,
      "error",
      "The toolchain failed to run: worker crashed",
    ],
  ])("describes %j", (outcome, tone, summary) => {
    expect(describeOutcome(outcome)).toEqual({
      tone,
      summary,
      diagnostics: [],
      listing: [],
    });
  });
});

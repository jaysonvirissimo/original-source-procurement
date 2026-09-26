import { describe, expect, it } from "vitest";
import { compareRelocations, describeRelocation } from "./relocations.ts";
import type { FunctionRelocation, RelocationTargetIdentity } from "./types.ts";

function relocation(
  offset: number,
  target: RelocationTargetIdentity,
): FunctionRelocation {
  return {
    offset,
    kind: "HI16",
    fieldMask: 0xffff,
    fieldValue: 0,
    target,
  };
}

const g = (addend: number): RelocationTargetIdentity => ({
  kind: "symbol",
  name: "g",
  addend,
});

describe("describeRelocation", () => {
  it("writes symbol targets with their addend", () => {
    expect(describeRelocation(relocation(0, g(0)))).toBe("HI16 g");
    expect(describeRelocation(relocation(0, g(4)))).toBe("HI16 g+4");
    expect(describeRelocation(relocation(0, g(-8)))).toBe("HI16 g-8");
  });

  it("writes section targets by offset and ignores the label", () => {
    expect(
      describeRelocation(
        relocation(0, {
          kind: "section",
          section: ".data",
          offset: 16,
          label: "table",
        }),
      ),
    ).toBe("HI16 .data+0x10");
  });
});

describe("compareRelocations", () => {
  it("accepts equal relocations, whatever their order or labels", () => {
    const section = (label: string): RelocationTargetIdentity => ({
      kind: "section",
      section: ".data",
      offset: 4,
      label,
    });
    expect(
      compareRelocations(
        [relocation(4, g(0)), relocation(0, section("a"))],
        [relocation(0, section("b")), relocation(4, g(0))],
      ),
    ).toEqual([]);
  });

  it("reports a differing addend at its offset", () => {
    expect(
      compareRelocations([relocation(0, g(0))], [relocation(0, g(4))]),
    ).toEqual([
      {
        offset: 0,
        evidence: [
          "The target fills in the upper half of the address of g+4 here; your output fills in the upper half of the address of g.",
        ],
      },
    ]);
  });

  it("reports missing and extra relocations, counting duplicates", () => {
    expect(
      compareRelocations(
        [relocation(8, g(0)), relocation(8, g(0))],
        [relocation(8, g(0)), relocation(4, g(0))],
      ),
    ).toEqual([
      {
        offset: 4,
        evidence: [
          "The target fills in the upper half of the address of g here; your output does not.",
        ],
      },
      {
        offset: 8,
        evidence: [
          "Your output fills in the upper half of the address of g here; the target does not.",
        ],
      },
    ]);
  });

  it("names a call by its callee, and a section target by its label", () => {
    const call = (
      offset: number,
      target: RelocationTargetIdentity,
    ): FunctionRelocation => ({
      offset,
      kind: "MIPS26",
      fieldMask: 0x03ffffff,
      fieldValue: 0,
      target,
    });
    const h: RelocationTargetIdentity = {
      kind: "section",
      section: ".text",
      offset: 8,
      label: "h",
    };
    expect(
      compareRelocations([call(0, h)], [call(0, g(0))], new Set([0])),
    ).toEqual([
      {
        offset: 0,
        evidence: ["The target calls g here; your output calls h."],
      },
    ]);
    expect(compareRelocations([call(0, h)], [], new Set())).toEqual([
      {
        offset: 0,
        evidence: ["Your output jumps to h here; the target does not."],
      },
    ]);
  });

  it("describes every other kind in words", () => {
    const of = (kind: FunctionRelocation["kind"]): FunctionRelocation => ({
      ...relocation(0, g(0)),
      kind,
    });
    expect(
      compareRelocations([of("LO16"), of("GPREL16"), of("WORD32")], []).flatMap(
        (finding) => finding.evidence,
      ),
    ).toEqual([
      "Your output reaches g through $gp here; the target does not.",
      "Your output fills in the lower half of the address of g here; the target does not.",
      "Your output holds the address of g here; the target does not.",
    ]);
  });
});

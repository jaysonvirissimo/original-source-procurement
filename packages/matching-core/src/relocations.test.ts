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
          "Target relocates HI16 g+4 here; your output does not.",
          "Your output relocates HI16 g here; the target does not.",
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
        evidence: ["Target relocates HI16 g here; your output does not."],
      },
      {
        offset: 8,
        evidence: ["Your output relocates HI16 g here; the target does not."],
      },
    ]);
  });
});

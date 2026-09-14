import type { MatchResult } from "@osp/matching-core";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiffPanel } from "./DiffPanel";

// OSP-authored words and instruction text.
const result: MatchResult = {
  exact: false,
  score: 0.5,
  target: [
    { index: 0, word: 1, text: "lw $v1,0x20($a0)", fieldMask: 0 },
    { index: 1, word: 2, text: "jr $ra", fieldMask: 0 },
  ],
  generated: [
    {
      index: 0,
      word: 1,
      text: "lw $v1,0x20($a0)",
      fieldMask: 0xffff,
      origin: { line: 1, kind: "instruction" },
    },
    {
      index: 1,
      word: 3,
      text: "nop",
      fieldMask: 0,
      origin: {
        line: 2,
        kind: "load-delay-nop",
        note: "load delay: the next instruction reads $v1",
      },
    },
  ],
  alignment: [
    { target: 0, generated: 0, status: "field-only", mismatchIds: [] },
    {
      generated: 1,
      status: "inserted",
      mismatchIds: ["EXTRA_INSTRUCTION@t1g1"],
    },
    { target: 1, status: "deleted", mismatchIds: ["REGISTER@t1g2"] },
  ],
  mismatches: [
    {
      id: "REGISTER@t1g2",
      kind: "REGISTER",
      targetRange: { start: 1, end: 2 },
      generatedRange: { start: 2, end: 2 },
      confidence: 1,
      evidence: ["Target uses $v1; your output uses $v0."],
    },
    {
      id: "EXTRA_INSTRUCTION@t1g1",
      kind: "EXTRA_INSTRUCTION",
      targetRange: { start: 1, end: 1 },
      generatedRange: { start: 1, end: 2 },
      confidence: 1,
      evidence: ["load delay: the next instruction reads $v1"],
      consequenceOf: "REGISTER@t1g2",
    },
  ],
  fieldDifferences: [],
  summary: {
    exact: false,
    equalWords: 1,
    targetWords: 2,
    generatedWords: 2,
    byKind: { REGISTER: 1, EXTRA_INSTRUCTION: 1 },
  },
};

describe("DiffPanel", () => {
  it("labels every row with text as well as a symbol", () => {
    render(
      <DiffPanel
        result={result}
        stale={false}
        highlight={{ start: 1, end: 2 }}
      />,
    );

    const rows = within(
      screen.getByRole("table", { name: "Target and generated instructions" }),
    ).getAllByRole("row");
    expect(rows.map((row) => row.textContent)).toEqual([
      "StatusTargetGeneratedNote",
      "≈Equal outside relocated fieldslw $v1,0x20($a0)lw $v1,0x20($a0)",
      "+Extra in your outputnopload delay nop",
      "−Missing from your outputjr $raHINT",
    ]);
    expect(rows[2]?.querySelector("td[title]")?.getAttribute("title")).toBe(
      "load delay: the next instruction reads $v1",
    );
    expect(screen.queryByText(/^STALE/)).toBeNull();
  });

  it("lists mismatches with their evidence and causes, and labels a stale build", () => {
    render(<DiffPanel result={result} stale highlight={undefined} />);

    const items = within(
      screen.getByRole("list", { name: "Mismatches" }),
    ).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "RegisterTarget uses $v1; your output uses $v0.",
      "Extra instruction · caused by Registerload delay: the next instruction reads $v1",
    ]);
    expect(screen.getByText(/^STALE/)).toBeTruthy();
  });

  it("omits the mismatch list for an exact match", () => {
    render(
      <DiffPanel
        result={{ ...result, mismatches: [] }}
        stale={false}
        highlight={undefined}
      />,
    );

    expect(screen.queryByRole("list", { name: "Mismatches" })).toBeNull();
  });
});

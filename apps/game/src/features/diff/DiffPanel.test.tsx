import type { MatchResult } from "@osp/matching-core";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
        annotations={[]}
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
    render(
      <DiffPanel
        result={result}
        stale
        highlight={undefined}
        annotations={[]}
      />,
    );

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
        annotations={[]}
      />,
    );

    expect(screen.queryByRole("list", { name: "Mismatches" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Annotations" })).toBeNull();
  });

  it("labels annotated target rows and lists each note in full", () => {
    render(
      <DiffPanel
        result={result}
        stale={false}
        highlight={{ start: 1, end: 2 }}
        annotations={[
          {
            range: { start: 1, end: 2 },
            label: "delay slot",
            text: "Runs before the jump takes effect.",
            explained: true,
          },
          {
            range: { start: 0, end: 2 },
            label: "note",
            text: "The whole function.",
            explained: true,
          },
        ]}
      />,
    );

    const rows = within(
      screen.getByRole("table", { name: "Target and generated instructions" }),
    ).getAllByRole("row");
    expect(rows.map((row) => row.textContent)).toEqual([
      "StatusTargetGeneratedNote",
      "≈Equal outside relocated fieldslw $v1,0x20($a0)lw $v1,0x20($a0)note",
      "+Extra in your outputnopload delay nop",
      "−Missing from your outputjr $radelay slot · note · HINT",
    ]);
    expect(
      within(screen.getByRole("list", { name: "Annotations" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Word 1 · delay slotRuns before the jump takes effect.",
      "Words 0–1 · noteThe whole function.",
    ]);
  });

  it("labels an inserted nop once when an annotation names it too", () => {
    const nopFirst: MatchResult = {
      ...result,
      generated: result.generated.map((word) =>
        word.index === 0
          ? { ...word, origin: { line: 1, kind: "branch-delay-nop" } }
          : word,
      ),
    };
    render(
      <DiffPanel
        result={nopFirst}
        stale={false}
        highlight={undefined}
        annotations={[
          {
            range: { start: 0, end: 1 },
            label: "branch delay nop",
            text: "The assembler inserted this nop.",
            explained: true,
          },
        ]}
      />,
    );

    const rows = within(
      screen.getByRole("table", { name: "Target and generated instructions" }),
    ).getAllByRole("row");
    expect(rows[1]?.textContent).toBe(
      "≈Equal outside relocated fieldslw $v1,0x20($a0)lw $v1,0x20($a0)branch delay nop",
    );
  });

  it("opens a mismatch on request: marks its rows, explains its kind, and shows hypotheses", () => {
    const { rerender } = render(
      <DiffPanel
        result={result}
        stale={false}
        highlight={undefined}
        annotations={[]}
        hypotheses={[
          {
            kind: "LIKELY_EXPRESSION_SHAPE",
            confidence: 0.6,
            message: "The source may use another register. Check it.",
            evidenceMismatchIds: ["REGISTER@t1g2"],
          },
        ]}
      />,
    );
    // Only the mismatches themselves, not the hypotheses listed inside one.
    const items = () => {
      const list = screen.getByRole("list", { name: "Mismatches" });
      return within(list)
        .getAllByRole("listitem")
        .filter((entry) => entry.parentElement === list);
    };
    const item = (index: number) => {
      const found = items()[index];
      if (found === undefined) {
        throw new Error(`No mismatch at ${String(index)}.`);
      }
      return found;
    };
    const table = () =>
      within(
        screen.getByRole("table", {
          name: "Target and generated instructions",
        }),
      ).getAllByRole("row");

    expect(screen.queryByText("HYPOTHESIS")).toBeNull();
    expect(table().some((row) => row.textContent.includes("SELECTED"))).toBe(
      false,
    );

    const register = within(item(0)).getByRole("button", {
      name: "Register",
    });
    expect(register.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(register);
    expect(register.getAttribute("aria-expanded")).toBe("true");
    expect(items()[0]?.textContent).toContain(
      "The same operation uses different registers.",
    );
    expect(
      within(screen.getByRole("list", { name: "Hypotheses" })).getByRole(
        "listitem",
      ).textContent,
    ).toBe("HYPOTHESIS The source may use another register. Check it.");
    expect(table()[3]?.textContent).toContain("SELECTED");
    expect(table()[3]?.getAttribute("data-selected")).toBe("true");

    fireEvent.click(
      within(item(1)).getByRole("button", { name: "Extra instruction" }),
    );
    expect(items()[1]?.textContent).toContain(
      "Your output has instructions the target lacks.",
    );
    expect(screen.queryByRole("list", { name: "Hypotheses" })).toBeNull();
    expect(table()[2]?.textContent).toContain("SELECTED");

    fireEvent.click(within(item(1)).getByRole("button", { name: "Register" }));
    expect(register.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(register);
    expect(register.getAttribute("aria-expanded")).toBe("false");
    expect(table().some((row) => row.textContent.includes("SELECTED"))).toBe(
      false,
    );

    fireEvent.click(register);
    rerender(
      <DiffPanel
        result={{
          ...result,
          mismatches: result.mismatches.map((mismatch) => ({
            ...mismatch,
            id: `${mismatch.id}-next`,
          })),
        }}
        stale={false}
        highlight={undefined}
        annotations={[]}
      />,
    );
    expect(
      within(item(0))
        .getByRole("button", { name: "Register" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });
});

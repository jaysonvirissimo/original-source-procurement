import { describe, expect, it } from "vitest";
import { renderReviewReport } from "./report.ts";
import {
  functionRecord,
  importIndex,
  pinnedTarget,
  unpinnedRecord,
  SAMPLE_FACTS,
  verdictIndex,
  SDK_COMMIT,
  UPSTREAM_COMMIT,
} from "./testing.ts";

describe("renderReviewReport", () => {
  it("heads the report with the revisions and the counts", () => {
    const text = renderReviewReport(importIndex());
    expect(text).toContain(`mgs_reversing: ${UPSTREAM_COMMIT}`);
    expect(text).toContain(`psyq_sdk: ${SDK_COMMIT}`);
    expect(text).toContain("functions in the inventory: 1");
    expect(text).toContain("solved: 1, with a pinned target: 1");
  });

  it("says so plainly when every pointer was pinned", () => {
    expect(renderReviewReport(importIndex())).toContain("None.");
  });

  it("groups the pointers it could not pin by reason", () => {
    const text = renderReviewReport(
      importIndex({
        functions: [
          unpinnedRecord({ reason: "no-deletion" }),
          unpinnedRecord(
            { reason: "word-count", detail: "found 2, expected 4" },
            { symbol: "other" },
          ),
        ],
      }),
    );
    expect(text).toContain("### no-deletion (1)");
    expect(text).toContain("- other — found 2, expected 4");
  });

  it("truncates a long list of rejections", () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      unpinnedRecord(
        { reason: "no-deletion" },
        { symbol: `f${String(index)}` },
      ),
    );
    expect(renderReviewReport(importIndex({ functions: many }))).toContain(
      "and 5 more",
    );
  });

  it("ranks the pinned candidates smallest first, with their tags", () => {
    const text = renderReviewReport(
      importIndex({
        functions: [
          functionRecord(),
          functionRecord({
            symbol: "smaller",
            pinned: pinnedTarget({
              facts: { ...SAMPLE_FACTS, words: 2 },
              tags: [],
            }),
          }),
        ],
      }),
    );
    expect(text).toContain("| symbol | words | branches | calls | tags |");
    expect(text.indexOf("| smaller |")).toBeLessThan(
      text.indexOf("| sample_function |"),
    );
    expect(text).toContain(
      "| sample_function | 4 | 0 | 0 | load, field-offset |",
    );
  });

  it("adds the verdicts once the sweep has run, counted by kind", () => {
    const text = renderReviewReport(
      importIndex(),
      verdictIndex({
        functions: [
          {
            symbol: "sample_function",
            sourcePath: "source/sample/sample.c",
            verdict: "exact",
          },
          {
            symbol: "other_function",
            sourcePath: "source/sample/sample.c",
            verdict: "mismatch",
            mismatchKinds: ["REGISTER"],
          },
        ],
      }),
    );
    expect(text).toContain("## Reproduction verdicts");
    expect(text).toContain("- exact: 1");
    expect(text).toContain("- mismatch: 1");
    expect(text).toContain("- sample_function — source/sample/sample.c");
  });

  it("truncates a long list of exact candidates", () => {
    const many = Array.from({ length: 45 }, (_, index) => ({
      symbol: `f${String(index)}`,
      sourcePath: "source/sample/sample.c",
      verdict: "exact" as const,
    }));
    expect(
      renderReviewReport(importIndex(), verdictIndex({ functions: many })),
    ).toContain("and 5 more");
  });
});

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
  fileRecord,
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
  describe("the early field shortlist", () => {
    const exact = (symbol: string, sourcePath = "source/sample/sample.c") => ({
      symbol,
      sourcePath,
      verdict: "exact" as const,
    });
    const record = (symbol: string, facts: Partial<typeof SAMPLE_FACTS> = {}) =>
      functionRecord({
        symbol,
        pinned: pinnedTarget({ facts: { ...SAMPLE_FACTS, ...facts } }),
      });
    const shortlistOf = (text: string) =>
      text.slice(text.indexOf("## Early field shortlist"));

    it("is left out until the sweep has run", () => {
      expect(renderReviewReport(importIndex())).not.toContain(
        "Early field shortlist",
      );
    });

    it("lists exact functions smallest first", () => {
      const text = shortlistOf(
        renderReviewReport(
          importIndex({
            files: [
              fileRecord(),
              fileRecord({
                path: "source/other/other.c",
                compiler: { ...fileRecord().compiler, gpSize: 8 },
              }),
            ],
            functions: [
              record("larger", { words: 6, stores: 2, narrowLoads: 1 }),
              record("smaller", { words: 3 }),
            ],
          }),
          verdictIndex({
            functions: [
              exact("larger", "source/other/other.c"),
              exact("smaller"),
            ],
          }),
        ),
      );
      expect(text).toContain(
        "| smaller | 3 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | source/sample/sample.c |",
      );
      expect(text).toContain(
        "| larger | 6 | 0 | 0 | 0 | 0 | 1 | 2 | 1 | 0 | 1 | 0 | 0 | 8 | 1 | source/other/other.c |",
      );
      expect(text.indexOf("| smaller |")).toBeLessThan(
        text.indexOf("| larger |"),
      );
    });

    it("leaves out mismatches, used symbols, and untaught machinery", () => {
      const text = shortlistOf(
        renderReviewReport(
          importIndex({
            functions: [
              record("coprocessor", { coprocessor: 1 }),
              record("divide", { multiplyDivide: 1 }),
              record("used"),
              record("mismatched"),
            ],
          }),
          verdictIndex({
            functions: [
              exact("coprocessor"),
              exact("divide"),
              exact("used"),
              {
                symbol: "mismatched",
                sourcePath: "source/sample/sample.c",
                verdict: "mismatch",
                mismatchKinds: ["REGISTER"],
              },
            ],
          }),
          new Set(["used"]),
        ),
      );
      expect(text).toContain("None.");
    });

    it("keeps narrow stores and global storage, and shows which each uses", () => {
      // The course teaches both by the memory widths phase, so the shortlist
      // reports the shape in a column rather than filtering the function out.
      const text = shortlistOf(
        renderReviewReport(
          importIndex({
            functions: [
              record("narrow_store", { narrowStores: 1, stores: 1 }),
              record("global_pointer", { gpAccesses: 1 }),
              record("absolute", { upperImmediates: 1, absoluteAccesses: 1 }),
            ],
          }),
          verdictIndex({
            functions: [
              exact("narrow_store"),
              exact("global_pointer"),
              exact("absolute"),
            ],
          }),
        ),
      );
      expect(text).toContain(
        "| narrow_store | 4 | 0 | 0 | 0 | 0 | 1 | 1 | 0 | 1 | 1 | 0 | 0 | 0 | 1 | source/sample/sample.c |",
      );
      expect(text).toContain(
        "| global_pointer | 4 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 1 | source/sample/sample.c |",
      );
      expect(text).toContain(
        "| absolute | 4 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 1 | source/sample/sample.c |",
      );
    });

    it("keeps control flow, calls and a stack frame, and shows each", () => {
      // The branches, loops and functions phases teach all of it, so the
      // shortlist reports the shape rather than filtering the function out.
      const text = shortlistOf(
        renderReviewReport(
          importIndex({
            functions: [
              record("branchy", { branches: 2, loops: 1 }),
              record("caller", { calls: 1, stackAccesses: 2 }),
            ],
          }),
          verdictIndex({
            functions: [exact("branchy"), exact("caller")],
          }),
        ),
      );
      expect(text).toContain(
        "| branchy | 4 | 2 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | source/sample/sample.c |",
      );
      expect(text).toContain(
        "| caller | 4 | 0 | 0 | 1 | 2 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | source/sample/sample.c |",
      );
    });

    it("gives each shape its own table and cap", () => {
      // Straight-line functions are the smallest, so one capped table would
      // never reach a function with a branch or a call.
      const straight = Array.from({ length: 41 }, (_, index) =>
        record(`straight_${String(index).padStart(2, "0")}`, { words: 2 }),
      );
      const text = shortlistOf(
        renderReviewReport(
          importIndex({
            functions: [
              ...straight,
              record("branchy", { words: 9, branches: 1 }),
              record("caller", { words: 9, calls: 1, stackAccesses: 2 }),
            ],
          }),
          verdictIndex({
            functions: [
              ...straight.map((entry) => exact(entry.symbol)),
              exact("branchy"),
              exact("caller"),
            ],
          }),
        ),
      );
      expect(text).toContain("### Straight line (41)");
      expect(text).toContain("… and 1 more");
      expect(text).not.toContain("| straight_40 |");
      expect(text).toContain("### Branches (1)");
      expect(text).toContain("| branchy | 9 |");
      expect(text).toContain("### Calls (1)");
      expect(text).toContain("| caller | 9 |");
    });

    it("marks a file missing from the import instead of guessing", () => {
      const text = shortlistOf(
        renderReviewReport(
          importIndex({
            files: [
              fileRecord({
                compiler: {
                  ...fileRecord().compiler,
                  remoteHeaders: undefined,
                },
              }),
            ],
            functions: [
              record("bare"),
              record("orphan"),
              unpinnedRecord({ reason: "no-deletion" }, { symbol: "unpinned" }),
            ],
          }),
          verdictIndex({
            functions: [
              exact("bare"),
              exact("orphan", "source/gone/gone.c"),
              exact("unpinned"),
            ],
          }),
        ),
      );
      expect(text).toContain(
        "| bare | 4 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | source/sample/sample.c |",
      );
      expect(text).toContain(
        "| orphan | 4 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | ? | ? | source/gone/gone.c |",
      );
      expect(text).not.toContain("| unpinned |");
    });
  });
});

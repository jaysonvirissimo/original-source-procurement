import type { MatchResult } from "@osp/matching-core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MatchSummary } from "./MatchSummary";

const result: MatchResult = {
  exact: false,
  score: 0,
  target: [],
  generated: [],
  mismatches: [],
  alignment: [],
  fieldDifferences: [],
  summary: {
    exact: false,
    equalWords: 0,
    targetWords: 1,
    generatedWords: 1,
    byKind: { LOAD_SIGNEDNESS: 1, MEMORY_OFFSET: 2 },
  },
};

describe("MatchSummary", () => {
  it("reads each mismatch count as a number of differences", () => {
    render(
      <MatchSummary
        result={result}
        hints={{ opened: 0, available: 5, stage: 0 }}
      />,
    );

    const valueOf = (term: string) =>
      screen.getByText(term).nextElementSibling?.textContent;
    expect(valueOf("LOAD SIGNEDNESS")).toBe("1 difference");
    expect(valueOf("MEMORY OFFSET")).toBe("2 differences");
    expect(valueOf("EXACT MATCH")).toBe("NO");
  });
});

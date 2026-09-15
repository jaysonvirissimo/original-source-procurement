import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TargetListing } from "./TargetListing";

describe("TargetListing", () => {
  it("numbers target words and labels annotations and hints", () => {
    render(
      <TargetListing
        lines={["jr $ra", "addiu $v0,$zero,0x2A"]}
        highlight={{ start: 1, end: 2 }}
        annotations={[
          {
            range: { start: 1, end: 2 },
            label: "delay slot",
            text: "Runs before the jump takes effect.",
            manualEntry: "mips.delay-slots",
            explained: true,
          },
        ]}
      />,
    );

    expect(
      within(screen.getByRole("table", { name: "Target instructions" }))
        .getAllByRole("row")
        .map((row) => row.textContent),
    ).toEqual([
      "WordTargetNote",
      "0jr $ra",
      "1addiu $v0,$zero,0x2Adelay slot · HINT",
    ]);
    expect(screen.getByRole("list", { name: "Annotations" }).textContent).toBe(
      "Word 1 · delay slotRuns before the jump takes effect.",
    );
  });

  it("labels notes without listing their text when the help level does not explain them", () => {
    render(
      <TargetListing
        lines={["jr $ra", "nop"]}
        highlight={undefined}
        annotations={[
          {
            range: { start: 1, end: 2 },
            label: "branch delay nop",
            text: "The assembler inserted this nop.",
            explained: false,
          },
        ]}
      />,
    );

    expect(
      within(screen.getByRole("table", { name: "Target instructions" }))
        .getAllByRole("row")
        .map((row) => row.textContent),
    ).toEqual(["WordTargetNote", "0jr $ra", "1nopbranch delay nop"]);
    expect(screen.queryByRole("list", { name: "Annotations" })).toBeNull();
  });

  it("omits the annotation list when there are no annotations", () => {
    render(
      <TargetListing
        lines={["jr $ra"]}
        highlight={undefined}
        annotations={[]}
      />,
    );

    expect(screen.queryByRole("list", { name: "Annotations" })).toBeNull();
  });
});

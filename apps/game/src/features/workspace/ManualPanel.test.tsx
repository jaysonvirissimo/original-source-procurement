import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ManualPanel } from "./ManualPanel";

describe("ManualPanel", () => {
  it("lists each known skill once, with its manual entry when there is one", () => {
    const onClose = vi.fn();
    render(
      <ManualPanel
        mission={{
          teaches: ["ABI.ARGUMENT"],
          requires: ["ABI.RETURN", "OSP.UNKNOWN"],
          practices: ["ABI.ARGUMENT"],
        }}
        catalog={{
          skills: [
            {
              id: "ABI.RETURN",
              name: "Return values",
              description: "An integer result leaves a function in $v0.",
              prerequisites: [],
              manualEntry: "abi.return-values",
            },
            {
              id: "ABI.ARGUMENT",
              name: "Arguments",
              description: "Arguments arrive in $a0 to $a3.",
              prerequisites: [],
              manualEntry: "abi.missing",
            },
          ],
          manualEntries: [
            { id: "abi.return-values", section: "ABI", title: "Return values" },
          ],
        }}
        onClose={onClose}
      />,
    );

    const manual = screen.getByRole("region", { name: "Manual" });
    expect(
      within(manual)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "ABI.ARGUMENTArgumentsArguments arrive in $a0 to $a3.",
      "ABI · Return valuesReturn valuesAn integer result leaves a function in $v0.",
    ]);
    fireEvent.click(within(manual).getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

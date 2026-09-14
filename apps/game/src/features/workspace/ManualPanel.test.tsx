import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MissionCatalog } from "../curriculum/missionCatalog";
import { ManualPanel } from "./ManualPanel";

const catalog: Pick<MissionCatalog, "skills" | "manualEntries"> = {
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
    {
      id: "ABI.SECOND",
      name: "Second use",
      description: "Shares the return values entry.",
      prerequisites: [],
      manualEntry: "abi.return-values",
    },
  ],
  manualEntries: [
    {
      id: "abi.return-values",
      section: "ABI",
      title: "Return values",
      body: ["An int result is in $v0."],
    },
    {
      id: "mips.delay-slots",
      section: "MIPS",
      title: "Delay slots",
      body: ["The instruction after a jump runs first.", "Then the jump."],
    },
  ],
};

function items() {
  return within(screen.getByRole("region", { name: "Manual" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
}

describe("ManualPanel", () => {
  it("lists each known skill once, with its entry's body the first time it appears", () => {
    const onClose = vi.fn();
    render(
      <ManualPanel
        mission={{
          teaches: ["ABI.ARGUMENT"],
          requires: ["ABI.RETURN", "OSP.UNKNOWN"],
          practices: ["ABI.ARGUMENT", "ABI.SECOND"],
        }}
        catalog={catalog}
        linkedEntries={[]}
        onClose={onClose}
      />,
    );

    expect(items()).toEqual([
      "ABI.ARGUMENTArgumentsArguments arrive in $a0 to $a3.",
      "ABI · Return valuesReturn valuesAn integer result leaves a function in $v0.An int result is in $v0.",
      "ABI · Return valuesSecond useShares the return values entry.",
    ]);
    fireEvent.click(
      within(screen.getByRole("region", { name: "Manual" })).getByRole(
        "button",
        { name: "Close" },
      ),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("adds entries that annotations link to, once, after the skills", () => {
    render(
      <ManualPanel
        mission={{ teaches: ["ABI.RETURN"], requires: [], practices: [] }}
        catalog={catalog}
        linkedEntries={[
          "mips.delay-slots",
          "abi.return-values",
          "mips.delay-slots",
          "mips.unknown",
        ]}
        onClose={vi.fn()}
      />,
    );

    expect(items()).toEqual([
      "ABI · Return valuesReturn valuesAn integer result leaves a function in $v0.An int result is in $v0.",
      "MIPSDelay slotsThe instruction after a jump runs first.Then the jump.",
    ]);
  });
});

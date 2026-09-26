import { realMissionTextIssues } from "@osp/mission-schema";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldProvenance } from "./FieldProvenance";
import type { MissionProvenance } from "./provenance";
import { PROVENANCE_LEGEND } from "./provenanceLegend";

const provenance: MissionProvenance = {
  repository: "FoxdieTeam/mgs_reversing",
  overlay: "main",
  symbol: "sample_function",
  address: "0x80010000",
  target: {
    path: "asm/sample/sample_function.s",
    commit: "a".repeat(40),
    url: undefined,
  },
};

function terms(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole("term")
    .map((term) => term.textContent);
}

describe("FieldProvenance", () => {
  it("explains every label in a folded legend", () => {
    render(<FieldProvenance provenance={provenance} />);
    const readout = screen.getByLabelText("Provenance");
    const legend = screen.getByLabelText("What the labels mean");

    expect(terms(legend)).toEqual(terms(readout));
    expect(legend.closest("details")?.open).toBe(false);
    expect(readout.textContent).toContain("asm/sample/sample_function.s");
    expect(readout.textContent).toContain("aaaaaaaa");
  });

  it("says only the symbol matters while solving", () => {
    const ignorable = PROVENANCE_LEGEND.filter(({ meaning }) =>
      meaning.includes("You can ignore it while solving."),
    ).map(({ term }) => term);
    expect(ignorable).toEqual(["Matched by", "Overlay", "Address", "Target"]);
  });

  it("quotes no instructions, registers, or values", () => {
    for (const { meaning } of PROVENANCE_LEGEND) {
      expect(realMissionTextIssues(meaning)).toEqual([]);
    }
  });

  it("links the target file only once the function is matched", () => {
    const url = "https://github.com/FoxdieTeam/mgs_reversing/blob/x/a.s";
    const linked = { ...provenance, target: { ...provenance.target, url } };
    const { rerender } = render(<FieldProvenance provenance={linked} />);
    const readout = screen.getByLabelText("Provenance");
    expect(within(readout).queryByRole("link")).toBeNull();
    expect(readout.textContent).toContain("asm/sample/sample_function.s");

    rerender(<FieldProvenance provenance={linked} linked />);
    expect(
      within(screen.getByLabelText("Provenance"))
        .getByRole("link")
        .getAttribute("href"),
    ).toBe(url);
  });

  it("omits Address from the readout when it is unknown", () => {
    render(
      <FieldProvenance provenance={{ ...provenance, address: undefined }} />,
    );
    expect(terms(screen.getByLabelText("Provenance"))).not.toContain("Address");
  });
});

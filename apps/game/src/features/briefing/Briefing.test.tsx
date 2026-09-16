import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Mission } from "@osp/mission-schema";
import { realMission, syntheticMission } from "@osp/mission-schema/testing";
import { Briefing } from "./Briefing";

function sample(fields: Partial<Mission>): Mission {
  return syntheticMission(fields);
}

const guided = {
  layout: "guided",
  skills: new Map(),
  automaticTeaching: true,
} as const;

describe("Briefing", () => {
  it("omits a missing technique and names unknown prerequisites by ID, with the player's state", () => {
    const onEnter = vi.fn();
    render(
      <Briefing
        mission={sample({
          id: "900",
          phase: "Translation",
          title: "SAMPLE",
          briefing: { objective: "Return a constant." },
          requires: ["ABI.RETURN", "OSP.UNKNOWN"],
          practices: [],
        })}
        skillNames={new Map([["ABI.RETURN", "Return values"]])}
        skillStates={new Map([["ABI.RETURN", "PRACTICED"]])}
        plan={guided}
        onEnter={onEnter}
      />,
    );

    expect(screen.queryByText("New technique")).toBeNull();
    expect(
      within(screen.getByRole("list", { name: "Prerequisite skills" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Return values · Practiced", "OSP.UNKNOWN · New"]);
    expect(
      screen.getByText(
        "Guided: notes and their explanations appear on their own.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enter" }));
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it("lists a synthesis mission's practiced skills as prerequisites once", () => {
    render(
      <Briefing
        mission={sample({
          id: "905",
          phase: "Registers and arithmetic",
          title: "SYNTHESIS",
          briefing: { objective: "Combine." },
          requires: [],
          practices: ["ABI.ARGUMENT", "MIPS.ARITH.SHIFT", "ABI.ARGUMENT"],
        })}
        skillNames={
          new Map([
            ["ABI.ARGUMENT", "Arguments"],
            ["MIPS.ARITH.SHIFT", "Shifts"],
          ])
        }
        skillStates={new Map()}
        plan={{ ...guided, layout: "assisted", automaticTeaching: false }}
        onEnter={vi.fn()}
      />,
    );

    expect(screen.queryByText("None")).toBeNull();
    expect(
      within(screen.getByRole("list", { name: "Prerequisite skills" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Arguments · New", "Shifts · New"]);
    expect(
      screen.getByText("Minimal: notes appear only through Scan."),
    ).toBeTruthy();
  });

  it("warns about expected skills not yet introduced, and still enters", () => {
    const onEnter = vi.fn();
    render(
      <Briefing
        mission={sample({
          id: "909",
          phase: "Memory",
          title: "SKIPPED AHEAD",
          briefing: { objective: "Read a field." },
          requires: ["C.POINTER.DEREFERENCE"],
          practices: [],
        })}
        skillNames={new Map([["C.POINTER.DEREFERENCE", "Dereference"]])}
        skillStates={new Map()}
        missing={[
          { id: "C.POINTER.DEREFERENCE", name: "Dereference" },
          { id: "MIPS.LOAD.WORD", name: "Load word" },
        ]}
        plan={guided}
        onEnter={onEnter}
      />,
    );

    expect(
      screen.getByText("Not yet introduced: Dereference, Load word."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enter" }));
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it("says None when a mission lists no prerequisite skills", () => {
    render(
      <Briefing
        mission={sample({
          id: "901",
          phase: "Translation",
          title: "FIRST",
          briefing: { objective: "Look." },
          requires: [],
          practices: [],
        })}
        skillNames={new Map()}
        skillStates={new Map()}
        plan={guided}
        onEnter={vi.fn()}
      />,
    );

    expect(screen.getByText("None")).toBeTruthy();
    expect(
      screen.queryByRole("list", { name: "Prerequisite skills" }),
    ).toBeNull();
    expect(screen.queryByRole("list", { name: "Terms" })).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Read the orientation" }),
    ).toBeNull();
  });

  it("defines the mission's terms and offers the orientation", () => {
    render(
      <Briefing
        mission={sample({ id: "001", title: "FIRST" })}
        skillNames={new Map()}
        skillStates={new Map()}
        plan={guided}
        terms={[
          {
            id: "glossary.register",
            section: "GLOSSARY",
            title: "register",
            body: ["A named 32-bit storage slot."],
          },
        ]}
        orientation
        onEnter={vi.fn()}
      />,
    );

    const terms = screen.getByRole("list", { name: "Terms" });
    expect(
      within(terms)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["registerA named 32-bit storage slot."]);
    expect(
      screen
        .getByRole("link", { name: "Read the orientation" })
        .getAttribute("href"),
    ).toBe("#/orientation");
  });
  it("shows a field mission's provenance and links its target, not its source", () => {
    const base = realMission();
    const mission = realMission({
      source: { ...base.source, address: 0x80010000 } as Mission["source"],
    });
    render(
      <Briefing
        mission={mission}
        skillNames={new Map()}
        skillStates={new Map()}
        plan={guided}
        onEnter={vi.fn()}
      />,
    );

    const readout = screen.getByLabelText("Provenance");
    expect(readout.textContent).toContain("FoxdieTeam/mgs_reversing");
    expect(readout.textContent).toContain("sample_function");
    expect(readout.textContent).toContain("0x80010000");
    const link = within(readout).getByRole("link");
    expect(link.getAttribute("href")).toMatch(
      /^https:\/\/github\.com\/FoxdieTeam\/mgs_reversing\/blob\/[0-9a-f]{40}\/asm\//,
    );
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(
      screen.getByRole("region", { name: "SAMPLE FIELD WORK" }).dataset.tier,
    ).toBe("field");
  });

  it("shows no provenance for a training mission", () => {
    render(
      <Briefing
        mission={syntheticMission()}
        skillNames={new Map()}
        skillStates={new Map()}
        plan={guided}
        onEnter={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Provenance")).toBeNull();
  });
});

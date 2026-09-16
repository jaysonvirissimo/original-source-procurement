import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { realMission } from "@osp/mission-schema/testing";
import { missionProvenance } from "../field/provenance";
import { MissionComplete } from "./MissionComplete";

describe("MissionComplete", () => {
  it("summarizes the run, corrects a wrong prediction, names skill changes, and focuses its heading", () => {
    const onReview = vi.fn();
    render(
      <MissionComplete
        exact
        attempts={11}
        hints={{ opened: 1, available: 3, stage: 2 }}
        mode="hinted"
        prediction={{ chosen: "$v0", answer: "$a0", correct: false }}
        skillChanges={[
          {
            skill: "ABI.ARGUMENT",
            before: "NEW",
            after: "INTRODUCED",
            solutionRevealed: false,
          },
          {
            skill: "ABI.RETURN",
            before: "PRACTICED",
            after: "PRACTICED",
            solutionRevealed: false,
          },
        ]}
        skillNames={
          new Map([
            ["ABI.ARGUMENT", "Arguments"],
            ["ABI.RETURN", "Return values"],
          ])
        }
        next={{ id: "003", title: "ADD IMMEDIATE" }}
        onReview={onReview}
        onPractice={vi.fn()}
      />,
    );

    const heading = screen.getByRole("heading", { name: "Mission complete" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("YES").previousElementSibling?.textContent).toBe(
      "EXACT MATCH",
    );
    expect(screen.getByText("11")).toBeTruthy();
    expect(screen.getByText("HINTS").nextElementSibling?.textContent).toBe(
      "1 of 3 · stage 2",
    );
    expect(screen.getByText("PREDICTION").nextElementSibling?.textContent).toBe(
      "First choice $v0; corrected to $a0.",
    );
    const skills = screen.getByRole("list");
    expect(
      within(skills)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Arguments: now Introduced", "Return values: still Practiced"]);
    expect(screen.queryByText(/ABI\./)).toBeNull();
    expect(screen.queryByText(/verified/i)).toBeNull();

    expect(screen.getByText("MODE").nextElementSibling?.textContent).toBe(
      "Hints to stage 2",
    );
    expect(screen.queryByRole("button", { name: "Practice again" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Review workspace" }));
    expect(onReview).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("link", { name: "Back to map" }).getAttribute("href"),
    ).toBe("#/");
    expect(
      screen
        .getByRole("link", { name: "Next mission · 003 ADD IMMEDIATE" })
        .getAttribute("href"),
    ).toBe("#/mission/003");
  });

  it("confirms a right prediction and says when a revealed solution held skills back", () => {
    render(
      <MissionComplete
        exact={false}
        attempts={1}
        hints={{ opened: 3, available: 3, stage: 9 }}
        mode="solution-revealed"
        prediction={{ chosen: "$a0", answer: "$a0", correct: true }}
        skillChanges={[
          {
            skill: "OSP.UNNAMED",
            before: "INTRODUCED",
            after: "INTRODUCED",
            solutionRevealed: true,
          },
        ]}
        skillNames={new Map()}
        next={undefined}
        onReview={vi.fn()}
        onPractice={vi.fn()}
      />,
    );

    expect(screen.getByText("NO")).toBeTruthy();
    expect(screen.getByText("PREDICTION").nextElementSibling?.textContent).toBe(
      "Correct: $a0",
    );
    expect(screen.getByText("OSP.UNNAMED: still Introduced")).toBeTruthy();
    expect(screen.getByText(/solution was revealed/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Next mission/ })).toBeNull();
    expect(screen.getByText(/No mission follows this one/)).toBeTruthy();
    expect(screen.getByText("MODE").nextElementSibling?.textContent).toBe(
      "Solution revealed",
    );
  });

  it("offers practice after a revealed solution", () => {
    const onPractice = vi.fn();
    render(
      <MissionComplete
        exact
        attempts={1}
        hints={{ opened: 2, available: 2, stage: 9 }}
        mode="solution-revealed"
        prediction={undefined}
        skillChanges={[]}
        skillNames={new Map()}
        next={undefined}
        onReview={vi.fn()}
        onPractice={onPractice}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Practice again" }));
    expect(onPractice).toHaveBeenCalledOnce();
  });

  it("omits the prediction and skills when there are none", () => {
    render(
      <MissionComplete
        exact
        attempts={2}
        hints={{ opened: 0, available: 3, stage: 0 }}
        mode={undefined}
        prediction={undefined}
        skillChanges={[]}
        skillNames={new Map()}
        next={undefined}
        onReview={vi.fn()}
        onPractice={vi.fn()}
      />,
    );

    expect(screen.queryByText("PREDICTION")).toBeNull();
    expect(screen.queryByText("MODE")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
  });
  it("shows where a field mission was recovered from", () => {
    render(
      <MissionComplete
        exact
        attempts={1}
        hints={{ opened: 0, available: 9, stage: 0 }}
        mode="independent"
        prediction={undefined}
        skillChanges={[]}
        skillNames={new Map()}
        next={undefined}
        provenance={missionProvenance(realMission())}
        onReview={vi.fn()}
        onPractice={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Provenance").textContent).toContain(
      "sample_function",
    );
  });
});

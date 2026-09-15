import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MissionComplete } from "./MissionComplete";

describe("MissionComplete", () => {
  it("summarizes the run, corrects a wrong prediction, names skill changes, and focuses its heading", () => {
    const onContinue = vi.fn();
    render(
      <MissionComplete
        exact
        attempts={11}
        hints={1}
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
        onContinue={onContinue}
      />,
    );

    const heading = screen.getByRole("heading", { name: "Mission complete" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("YES").previousElementSibling?.textContent).toBe(
      "EXACT MATCH",
    );
    expect(screen.getByText("11")).toBeTruthy();
    expect(screen.getByText("PREDICTION").nextElementSibling?.textContent).toBe(
      "Not correct: you chose $v0; the answer is $a0.",
    );
    const skills = screen.getByRole("list");
    expect(
      within(skills)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Arguments: now Introduced", "Return values: still Practiced"]);
    expect(screen.queryByText(/ABI\./)).toBeNull();
    expect(screen.queryByText(/verified/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledOnce();
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
        hints={3}
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
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText("NO")).toBeTruthy();
    expect(screen.getByText("PREDICTION").nextElementSibling?.textContent).toBe(
      "Correct: $a0",
    );
    expect(screen.getByText("OSP.UNNAMED: still Introduced")).toBeTruthy();
    expect(screen.getByText(/solution was revealed/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Next mission/ })).toBeNull();
  });

  it("omits the prediction and skills when there are none", () => {
    render(
      <MissionComplete
        exact
        attempts={2}
        hints={0}
        prediction={undefined}
        skillChanges={[]}
        skillNames={new Map()}
        next={undefined}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.queryByText("PREDICTION")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
  });
});

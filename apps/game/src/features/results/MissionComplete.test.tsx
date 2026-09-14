import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MissionComplete } from "./MissionComplete";

describe("MissionComplete", () => {
  it("summarizes the run, names the skill, and focuses its heading", () => {
    const onReview = vi.fn();
    render(
      <MissionComplete
        mission={{
          id: "003",
          title: "ADD IMMEDIATE",
          teaches: ["MIPS.ARITH.ADD_IMMEDIATE"],
        }}
        exact
        attempts={11}
        hints={1}
        skillNames={new Map([["MIPS.ARITH.ADD_IMMEDIATE", "Add immediate"]])}
        onReview={onReview}
      />,
    );

    const heading = screen.getByRole("heading", { name: "Mission complete" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("YES").previousElementSibling?.textContent).toBe(
      "EXACT MATCH",
    );
    expect(screen.getByText("11")).toBeTruthy();
    expect(
      screen.getByText("MIPS.ARITH.ADD_IMMEDIATE").parentElement?.textContent,
    ).toBe("MIPS.ARITH.ADD_IMMEDIATE Add immediate");
    fireEvent.click(
      screen.getByRole("button", { name: "Return to workspace" }),
    );
    expect(onReview).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("link", { name: "Mission map" }).getAttribute("href"),
    ).toBe("#/");
  });

  it("says when a mission teaches no new skill", () => {
    render(
      <MissionComplete
        mission={{ id: "005", title: "SCALE CHECK", teaches: [] }}
        exact={false}
        attempts={1}
        hints={0}
        skillNames={new Map()}
        onReview={vi.fn()}
      />,
    );

    expect(screen.getByText(/No new skill/)).toBeTruthy();
    expect(screen.getByText("NO")).toBeTruthy();
  });
});

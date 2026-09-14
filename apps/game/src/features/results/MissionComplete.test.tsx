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
        next={{ id: "004", title: "SHIFT LEFT" }}
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
    expect(
      screen
        .getByRole("link", { name: "Next mission · 004 SHIFT LEFT" })
        .getAttribute("href"),
    ).toBe("#/mission/004");
  });

  it("says when a mission teaches no new skill", () => {
    render(
      <MissionComplete
        mission={{ id: "005", title: "SCALE CHECK", teaches: [] }}
        exact={false}
        attempts={1}
        hints={0}
        skillNames={new Map()}
        next={undefined}
        onReview={vi.fn()}
      />,
    );

    expect(screen.getByText(/No new skill/)).toBeTruthy();
    expect(screen.getByText("NO")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Next mission/ })).toBeNull();
  });
});

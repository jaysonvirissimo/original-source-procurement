import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Briefing } from "./Briefing";

describe("Briefing", () => {
  it("omits a missing technique and names unknown prerequisites by ID", () => {
    const onEnter = vi.fn();
    render(
      <Briefing
        mission={{
          id: "900",
          phase: "Translation",
          title: "SAMPLE",
          briefing: { objective: "Return a constant." },
          requires: ["ABI.RETURN", "OSP.UNKNOWN"],
        }}
        skillNames={new Map([["ABI.RETURN", "Return values"]])}
        onEnter={onEnter}
      />,
    );

    expect(screen.queryByText("New technique")).toBeNull();
    expect(screen.getByText("Return values, OSP.UNKNOWN")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enter" }));
    expect(onEnter).toHaveBeenCalledOnce();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EvidencePanel } from "./EvidencePanel";

const prompt = {
  question: "Which instruction puts the return value in $v0?",
  range: { start: 1, end: 2 },
  retry: "Look for the write to $v0.",
};
const lines = ["jr $ra", "addiu $v0,$zero,0x2A"];

describe("EvidencePanel", () => {
  it("acknowledges the selected word", () => {
    const onAcknowledge = vi.fn();
    render(
      <EvidencePanel
        prompt={prompt}
        lines={lines}
        canAcknowledge
        miss={undefined}
        onAcknowledge={onAcknowledge}
      />,
    );

    const acknowledge = screen.getByRole("button", {
      name: "Acknowledge evidence",
    });
    expect(acknowledge).toHaveProperty("disabled", true);
    fireEvent.click(
      screen.getByRole("radio", { name: "Word 1 · addiu $v0,$zero,0x2A" }),
    );
    fireEvent.click(acknowledge);
    expect(onAcknowledge).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("waits for a current build before acknowledging", () => {
    render(
      <EvidencePanel
        prompt={prompt}
        lines={lines}
        canAcknowledge={false}
        miss={undefined}
        onAcknowledge={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Word 0 · jr $ra" }));
    expect(
      screen.getByRole("button", { name: "Acknowledge evidence" }),
    ).toHaveProperty("disabled", true);
    expect(
      screen.getByText(
        "Compile the current source, then select the instruction.",
      ),
    ).toBeTruthy();
  });

  it("points again after a selection outside the evidence", () => {
    render(
      <EvidencePanel
        prompt={prompt}
        lines={lines}
        canAcknowledge
        miss={0}
        onAcknowledge={vi.fn()}
      />,
    );

    expect(screen.getByRole("status").textContent).toBe(
      "Look for the write to $v0.",
    );
  });
});

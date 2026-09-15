import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PredictionPanel } from "./PredictionPanel";

const prompt = {
  question: "Which register carries the first integer argument?",
  choices: ["$v0", "$a0"],
  answer: 1,
  revealedBy: "The copy from $a0 shows it.",
};

describe("PredictionPanel", () => {
  it("records the chosen answer", () => {
    const onRecord = vi.fn();
    render(
      <PredictionPanel
        prompt={prompt}
        recorded={undefined}
        revealed={false}
        onRecord={onRecord}
      />,
    );

    const record = screen.getByRole("button", { name: "Record prediction" });
    expect(record).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("radio", { name: "$a0" }));
    fireEvent.click(record);
    expect(onRecord).toHaveBeenCalledWith(1);
  });

  it("waits for a build before revealing the answer", () => {
    render(
      <PredictionPanel
        prompt={prompt}
        recorded={{ missionId: "002", choice: 0, nextBuildId: 1 }}
        revealed={false}
        onRecord={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Compile to check it against the assembled output."),
    ).toBeTruthy();
    expect(screen.queryByText(/^Answer:/)).toBeNull();
  });

  it.each([
    [0, "Your prediction was not correct."],
    [1, "Your prediction was correct."],
  ])("after choice %i, says %s and shows the answer", (choice, verdict) => {
    render(
      <PredictionPanel
        prompt={prompt}
        recorded={{ missionId: "002", choice, nextBuildId: 1 }}
        revealed
        onRecord={vi.fn()}
      />,
    );

    const region = screen.getByRole("region", { name: "Prediction" });
    expect(region.textContent).toContain(verdict);
    expect(region.textContent).toContain(
      "Answer: $a0. The copy from $a0 shows it.",
    );
  });
});

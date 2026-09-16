import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { PredictionPanel } from "./PredictionPanel";

const prompt = {
  question: "Which register carries the first integer argument?",
  choices: ["$v0", "$a0", "$s0"],
  answer: 1,
  revealedBy: "The copy from $a0 shows it.",
};

function panel(overrides: Partial<ComponentProps<typeof PredictionPanel>>) {
  return render(
    <PredictionPanel
      prompt={prompt}
      recorded={undefined}
      revealed={false}
      onRecord={vi.fn()}
      correction={undefined}
      correctionMiss={undefined}
      canCorrect={false}
      onCorrect={vi.fn()}
      {...overrides}
    />,
  );
}

const wrong = { missionId: "002", choice: 0, nextBuildId: 1 };

describe("PredictionPanel", () => {
  it("records the chosen answer", () => {
    const onRecord = vi.fn();
    panel({ onRecord });

    const record = screen.getByRole("button", { name: "Record prediction" });
    expect(record).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("radio", { name: "$a0" }));
    fireEvent.click(record);
    expect(onRecord).toHaveBeenCalledWith(1);
  });

  it("waits for a build before revealing the answer", () => {
    panel({ recorded: wrong });

    expect(
      screen.getByText("Compile to check it against the assembled output."),
    ).toBeTruthy();
    expect(screen.queryByText(/^Answer:/)).toBeNull();
  });

  it("confirms a right prediction and shows the answer", () => {
    panel({ recorded: { ...wrong, choice: 1 }, revealed: true });

    const region = screen.getByRole("region", { name: "Prediction" });
    expect(region.textContent).toContain("Your prediction was correct.");
    expect(region.textContent).toContain(
      "Answer: $a0. The copy from $a0 shows it.",
    );
    expect(screen.queryByRole("button", { name: "Check answer" })).toBeNull();
  });

  it("asks for the answer the output shows after a wrong prediction", () => {
    const onCorrect = vi.fn();
    panel({ recorded: wrong, revealed: true, canCorrect: true, onCorrect });

    const region = screen.getByRole("region", { name: "Prediction" });
    expect(region.textContent).toContain(
      "Your prediction was not correct. The copy from $a0 shows it.",
    );
    expect(region.textContent).not.toContain("Answer:");
    const check = screen.getByRole("button", { name: "Check answer" });
    expect(check).toHaveProperty("disabled", true);
    const group = screen.getByRole("group", {
      name: "Which one does the output show?",
    });
    fireEvent.click(within(group).getByRole("radio", { name: "$s0" }));
    fireEvent.click(check);
    expect(onCorrect).toHaveBeenCalledWith(2);
  });

  it("explains a wrong correction without giving the answer away", () => {
    panel({
      recorded: wrong,
      revealed: true,
      canCorrect: true,
      correctionMiss: 2,
    });

    expect(screen.getByRole("status").textContent).toBe(
      "Not $s0. Read the output again.",
    );
  });

  it("asks for a current build before a correction can count", () => {
    panel({ recorded: wrong, revealed: true });

    expect(
      screen.getByText("Compile the current source to check your answer."),
    ).toBeTruthy();
  });

  it("shows the answer once the correction found it", () => {
    panel({
      recorded: wrong,
      revealed: true,
      correction: { missionId: "002", choice: 1, buildId: 1 },
    });

    const region = screen.getByRole("region", { name: "Prediction" });
    expect(region.textContent).toContain(
      "Your prediction was not correct. You found the answer in the output.",
    );
    expect(region.textContent).toContain("Answer: $a0.");
  });
});

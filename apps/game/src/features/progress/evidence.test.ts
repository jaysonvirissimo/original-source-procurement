import { describe, expect, it } from "vitest";
import { timestamp } from "../persistence/persistence.test-helpers";
import { shippedMission } from "../workspace/workspace.test-helpers";
import { completionEvidence, type EvidenceMission } from "./evidence";

const addImmediate = shippedMission("003");
const argumentZero = shippedMission("002");

const base: EvidenceMission = {
  ...addImmediate,
  kind: "training",
  requires: ["ABI.ARGUMENTS"],
  teaches: ["MIPS.ADD.IMMEDIATE"],
  practices: ["ABI.RETURN", "MIPS.ADD.IMMEDIATE"],
};

const facts = {
  completionId: "session:3",
  hintStage: 2,
  completedAt: timestamp(9),
};

function kinds(mission: EvidenceMission) {
  return completionEvidence(mission, facts).skills.map(({ skill, kind }) => [
    skill,
    kind,
  ]);
}

describe("completionEvidence", () => {
  it("records taught skills as introduced and practiced skills as practiced", () => {
    expect(kinds(base)).toEqual([
      ["MIPS.ADD.IMMEDIATE", "introduced"],
      ["ABI.RETURN", "practiced"],
    ]);
  });

  it("records a synthesis mission's required and practiced skills", () => {
    expect(kinds({ ...base, kind: "synthesis", teaches: [] })).toEqual([
      ["ABI.ARGUMENTS", "synthesis"],
      ["ABI.RETURN", "synthesis"],
      ["MIPS.ADD.IMMEDIATE", "synthesis"],
    ]);
  });

  it("records a real mission's required and practiced skills", () => {
    expect(kinds({ ...base, kind: "real-solved" })).toEqual([
      ["ABI.ARGUMENTS", "real"],
      ["ABI.RETURN", "real"],
      ["MIPS.ADD.IMMEDIATE", "real"],
    ]);
  });

  it("identifies each event by completion and skill, with hint use", () => {
    const [event] = completionEvidence(base, facts).skills;
    expect(event).toEqual({
      id: "session:3:MIPS.ADD.IMMEDIATE",
      completionId: "session:3",
      skill: "MIPS.ADD.IMMEDIATE",
      missionId: "003",
      kind: "introduced",
      hintMaxStage: 2,
      solutionRevealed: false,
      completedAt: timestamp(9),
    });
  });

  it("marks the solution revealed only once stage 9 was opened", () => {
    expect(addImmediate.hints.some((hint) => hint.stage === 9)).toBe(true);
    const revealed = (hintStage: number) =>
      completionEvidence(base, { ...facts, hintStage }).skills.every(
        (event) => event.solutionRevealed,
      );
    expect(revealed(4)).toBe(false);
    expect(revealed(9)).toBe(true);
  });

  it("records the prediction result apart from skill evidence", () => {
    const prompt = argumentZero.prediction;
    if (prompt === undefined) {
      throw new Error("Mission 002 has a prediction prompt.");
    }
    const wrong = (prompt.answer + 1) % prompt.choices.length;

    expect(
      completionEvidence(argumentZero, {
        ...facts,
        predictionChoice: prompt.answer,
      }).prediction,
    ).toEqual({
      id: "session:3:prediction",
      completionId: "session:3",
      missionId: "002",
      choice: prompt.answer,
      correct: true,
      recordedAt: timestamp(9),
    });
    expect(
      completionEvidence(argumentZero, { ...facts, predictionChoice: wrong })
        .prediction?.correct,
    ).toBe(false);
    expect(completionEvidence(argumentZero, facts)).not.toHaveProperty(
      "prediction",
    );
    expect(
      completionEvidence(base, { ...facts, predictionChoice: 0 }),
    ).not.toHaveProperty("prediction");
  });
});

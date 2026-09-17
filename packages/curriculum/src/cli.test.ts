import { describe, expect, it } from "vitest";
import { runValidation } from "./cli.ts";
import { curriculum } from "./index.ts";
import type { CurriculumData } from "./validate.ts";

function capture() {
  const log: string[] = [];
  const error: string[] = [];
  return {
    output: {
      log: (line: string) => log.push(line),
      error: (line: string) => error.push(line),
    },
    log,
    error,
  };
}

const oneSkill = {
  id: "S.A",
  name: "A",
  description: "A sample skill.",
  prerequisites: [],
  manualEntry: "sample.entry",
};

describe("runValidation", () => {
  it("reports the shipped curriculum as valid and exits 0", async () => {
    const { output, log, error } = capture();
    await expect(runValidation(curriculum, output)).resolves.toBe(0);
    // The last coverage warning was retired when a real mission joined the
    // path ahead of the final phase, so nothing follows the valid line.
    expect(log).toEqual([
      "Curriculum is valid: 25 skills, 34 missions, 34 on the default path.",
    ]);
    expect(error).toEqual([]);
  });

  it("prints one issue and exits 1", async () => {
    const { output, log, error } = capture();
    const data: CurriculumData = {
      skills: [oneSkill],
      manualEntries: [],
      missions: [],
      defaultPath: [],
    };
    await expect(runValidation(data, output)).resolves.toBe(1);
    expect(log).toEqual([]);
    expect(error).toEqual([
      "skills[0].manualEntry: Unknown manual entry sample.entry. [unknown-manual-entry]",
      "Curriculum validation failed with 1 issue.",
    ]);
  });

  it("counts several issues", async () => {
    const { output, error } = capture();
    const data: CurriculumData = {
      skills: [oneSkill],
      manualEntries: [],
      missions: [],
      defaultPath: ["m1"],
    };
    await expect(runValidation(data, output)).resolves.toBe(1);
    expect(error.at(-1)).toBe("Curriculum validation failed with 2 issues.");
  });

  it("prints nothing more for a valid curriculum with full coverage", async () => {
    const { output, log } = capture();
    const data: CurriculumData = {
      skills: [],
      manualEntries: [],
      missions: [],
      defaultPath: [],
    };
    await expect(runValidation(data, output)).resolves.toBe(0);
    expect(log).toEqual([
      "Curriculum is valid: 0 skills, 0 missions, 0 on the default path.",
    ]);
  });

  it("counts a single coverage warning in the singular", async () => {
    const { output, log } = capture();
    await expect(
      runValidation(
        { ...curriculum, defaultPath: ["001", "002", "003", "004", "005"] },
        output,
      ),
    ).resolves.toBe(0);
    expect(log.at(-1)).toBe("Coverage: 1 warning, not yet blocking.");
  });
});

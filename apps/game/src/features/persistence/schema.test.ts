import { describe, expect, it } from "vitest";
import {
  attempt,
  missionProgress,
  samplePlayer,
  skillEvidence,
} from "./persistence.test-helpers";
import {
  AttemptSchema,
  emptyPlayerState,
  PlayerStateSchema,
  SCAFFOLD_SETTINGS,
  scaffoldSetting,
  SettingsSchema,
} from "./schema";

describe("SettingsSchema", () => {
  it.each(SCAFFOLD_SETTINGS)("accepts the %s scaffold setting", (scaffold) => {
    expect(SettingsSchema.parse({ scaffold })).toEqual({ scaffold });
    expect(scaffoldSetting({ scaffold })).toBe(scaffold);
  });

  it("defaults to adaptive, and rejects settings it does not know", () => {
    expect(scaffoldSetting(SettingsSchema.parse({}))).toBe("adaptive");
    expect(SettingsSchema.safeParse({ scaffold: "loud" }).success).toBe(false);
    expect(SettingsSchema.safeParse({ theme: "dark" }).success).toBe(false);
  });
});

function issuePaths(value: unknown): string[] {
  const parsed = PlayerStateSchema.safeParse(value);
  return parsed.success
    ? []
    : parsed.error.issues.map((issue) => issue.path.join("."));
}

describe("PlayerStateSchema", () => {
  it("accepts a first-run state and a state with progress", () => {
    expect(PlayerStateSchema.safeParse(emptyPlayerState()).success).toBe(true);
    expect(PlayerStateSchema.parse(samplePlayer())).toEqual(samplePlayer());
  });

  it("rejects fields it does not know", () => {
    expect(
      PlayerStateSchema.safeParse({ ...emptyPlayerState(), extra: 1 }).success,
    ).toBe(false);
    expect(
      AttemptSchema.safeParse({ ...attempt(), note: "later" }).success,
    ).toBe(false);
  });

  it("accepts mismatch kinds by name, including kinds added later", () => {
    const summary = attempt().mismatchSummary;
    expect(
      AttemptSchema.safeParse(
        attempt({
          mismatchSummary: { ...summary, byKind: { BRANCH_TARGET: 2 } },
        }),
      ).success,
    ).toBe(true);
    expect(
      AttemptSchema.safeParse(
        attempt({
          mismatchSummary: { ...summary, byKind: { "not-a-kind": 1 } },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects an assembler version OSP does not model", () => {
    expect(
      AttemptSchema.safeParse({ ...attempt(), aspsxVersion: "2.56" }).success,
    ).toBe(false);
  });

  it("keys missions, attempts, and skill evidence consistently", () => {
    expect(
      issuePaths({
        ...emptyPlayerState(),
        missions: { "003": missionProgress({ missionId: "004" }) },
      }),
    ).toEqual(["missions.003.missionId"]);
    expect(
      issuePaths({
        ...emptyPlayerState(),
        missions: {
          "003": missionProgress({ attempts: [attempt({ missionId: "004" })] }),
        },
      }),
    ).toEqual(["missions.003.attempts.0.missionId"]);
    expect(
      issuePaths({
        ...emptyPlayerState(),
        skills: { "MIPS.LOAD.WORD": { evidence: [skillEvidence()] } },
      }),
    ).toEqual(["skills.MIPS.LOAD.WORD.evidence.0.skill"]);
  });
});

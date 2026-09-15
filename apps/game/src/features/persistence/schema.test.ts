import { describe, expect, it } from "vitest";
import {
  attempt,
  missionProgress,
  samplePlayer,
  skillEvidence,
} from "./persistence.test-helpers";
import {
  AttemptSchema,
  audioSettings,
  DEFAULT_AUDIO_SETTINGS,
  emptyPlayerState,
  GRAPHICS_SETTINGS,
  graphicsSetting,
  MOTION_SETTINGS,
  motionSetting,
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

  it.each(GRAPHICS_SETTINGS)("accepts the %s graphics setting", (graphics) => {
    expect(graphicsSetting(SettingsSchema.parse({ graphics }))).toBe(graphics);
  });

  it.each(MOTION_SETTINGS)("accepts the %s motion setting", (motion) => {
    expect(motionSetting(SettingsSchema.parse({ motion }))).toBe(motion);
  });

  it("reads saves without presentation settings as full graphics, system motion, and default audio", () => {
    const settings = SettingsSchema.parse({});
    expect(graphicsSetting(settings)).toBe("full");
    expect(motionSetting(settings)).toBe("system");
    expect(audioSettings(settings)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it("keeps audio channels independent and bounded", () => {
    const audio = {
      music: { volume: 0, muted: true },
      sfx: { volume: 1, muted: false },
    };
    expect(audioSettings(SettingsSchema.parse({ audio }))).toEqual(audio);
    expect(
      SettingsSchema.safeParse({
        audio: { ...audio, sfx: { volume: 1.5, muted: false } },
      }).success,
    ).toBe(false);
    expect(
      SettingsSchema.safeParse({ audio: { music: audio.music } }).success,
    ).toBe(false);
    expect(SettingsSchema.safeParse({ graphics: "ultra" }).success).toBe(false);
    expect(SettingsSchema.safeParse({ motion: "none" }).success).toBe(false);
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

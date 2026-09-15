import type { Mission } from "@osp/mission-schema";
import { describe, expect, it } from "vitest";
import type { ScaffoldSetting } from "../persistence/schema";
import {
  capLevel,
  levelForState,
  presentationFor,
  selectScaffold,
  supportLabel,
  type ScaffoldLevel,
} from "./scaffold";
import type { SkillState } from "./skillState";

type ScaffoldMission = Pick<Mission, "scaffold" | "teaches" | "practices">;

function states(
  entries: Record<string, SkillState>,
): (skill: string) => SkillState {
  return (skill) => entries[skill] ?? "NEW";
}

describe("levelForState", () => {
  it.each<[SkillState, ScaffoldLevel]>([
    ["NEW", "guided"],
    ["INTRODUCED", "guided"],
    ["PRACTICED", "assisted"],
    ["DEMONSTRATED", "independent"],
    ["MASTERED", "field"],
  ])("%s skills get %s help", (state, level) => {
    expect(levelForState(state)).toBe(level);
  });
});

describe("capLevel", () => {
  it.each<[ScaffoldLevel, ScaffoldLevel, ScaffoldLevel]>([
    ["guided", "guided", "guided"],
    ["guided", "assisted", "assisted"],
    ["guided", "independent", "independent"],
    ["guided", "field", "field"],
    ["field", "guided", "field"],
    ["independent", "assisted", "independent"],
    ["assisted", "independent", "independent"],
  ])("%s capped at %s is %s", (level, cap, expected) => {
    expect(capLevel(level, cap)).toBe(expected);
  });
});

describe("selectScaffold", () => {
  const loadWord: ScaffoldMission = {
    scaffold: "guided",
    teaches: ["MIPS.LOAD.WORD"],
    practices: [],
  };

  it("gives a first exposure guided help", () => {
    expect(selectScaffold(loadWord, states({}), "adaptive")).toEqual({
      layout: "guided",
      skills: new Map([["MIPS.LOAD.WORD", "guided"]]),
      automaticTeaching: true,
    });
  });

  it.each<[SkillState, ScaffoldLevel]>([
    ["PRACTICED", "assisted"],
    ["DEMONSTRATED", "independent"],
    ["MASTERED", "field"],
  ])("gives a %s skill %s help in a later mission", (state, level) => {
    const plan = selectScaffold(
      loadWord,
      states({ "MIPS.LOAD.WORD": state }),
      "adaptive",
    );
    expect(plan.layout).toBe(level);
    expect(plan.skills.get("MIPS.LOAD.WORD")).toBe(level);
  });

  it.each<[ScaffoldLevel, ScaffoldLevel]>([
    ["guided", "guided"],
    ["assisted", "assisted"],
    ["independent", "independent"],
    ["field", "field"],
  ])("caps a new skill at a %s mission's scaffold", (scaffold, expected) => {
    const plan = selectScaffold(
      { ...loadWord, scaffold },
      states({}),
      "adaptive",
    );
    expect(plan.skills.get("MIPS.LOAD.WORD")).toBe(expected);
    expect(plan.layout).toBe(expected);
  });

  it("guides a newly taught skill while familiar skills get less help, laying out for the most help", () => {
    const plan = selectScaffold(
      {
        scaffold: "guided",
        teaches: ["C.POINTER.DEREFERENCE"],
        practices: ["MIPS.LOAD.WORD", "ABI.ARGUMENT", "MIPS.LOAD.WORD"],
      },
      states({ "MIPS.LOAD.WORD": "DEMONSTRATED", "ABI.ARGUMENT": "MASTERED" }),
      "adaptive",
    );

    expect(plan.skills).toEqual(
      new Map([
        ["C.POINTER.DEREFERENCE", "guided"],
        ["MIPS.LOAD.WORD", "independent"],
        ["ABI.ARGUMENT", "field"],
      ]),
    );
    expect(plan.layout).toBe("guided");
  });

  it("uses the mission's scaffold when it lists no skills", () => {
    const plan = selectScaffold(
      { scaffold: "assisted", teaches: [], practices: [] },
      states({}),
      "adaptive",
    );
    expect(plan.layout).toBe("assisted");
    expect(plan.skills.size).toBe(0);
  });

  describe("settings", () => {
    const practiced = states({ "MIPS.LOAD.WORD": "MASTERED" });

    it.each<[ScaffoldSetting, ScaffoldLevel, boolean]>([
      ["adaptive", "field", true],
      ["full", "guided", true],
      ["minimal", "field", false],
    ])(
      "%s gives %s help, automatic teaching %s",
      (setting, level, automatic) => {
        const plan = selectScaffold(loadWord, practiced, setting);
        expect(plan.skills.get("MIPS.LOAD.WORD")).toBe(level);
        expect(plan.layout).toBe(level);
        expect(plan.automaticTeaching).toBe(automatic);
      },
    );

    it("keeps each mission's own cap under full", () => {
      const plan = selectScaffold(
        { ...loadWord, scaffold: "independent" },
        states({}),
        "full",
      );
      expect(plan.layout).toBe("independent");
    });
  });
});

describe("supportLabel", () => {
  it.each<[ScaffoldLevel, boolean, string]>([
    [
      "guided",
      true,
      "Guided: notes and their explanations appear on their own.",
    ],
    ["assisted", true, "Assisted: short labels appear; Scan explains them."],
    ["independent", true, "Independent: notes appear only through Scan."],
    [
      "field",
      true,
      "Field: a plain workspace; Scan, hints, and the manual stay available.",
    ],
    ["guided", false, "Minimal: notes appear only through Scan."],
  ])(
    "describes %s help with automatic teaching %s",
    (layout, automaticTeaching, label) => {
      expect(
        supportLabel({ layout, skills: new Map(), automaticTeaching }),
      ).toBe(label);
    },
  );
});

describe("presentationFor", () => {
  it.each<[ScaffoldLevel, boolean, boolean, boolean, boolean]>([
    ["guided", true, true, true, true],
    ["assisted", true, true, false, false],
    ["independent", true, false, false, false],
    ["field", true, false, false, false],
    ["guided", false, false, false, false],
    ["assisted", false, false, false, false],
  ])(
    "%s with automatic teaching %s shows labels %s, explanations %s, diagrams %s",
    (level, automatic, noteLabels, explanations, diagrams) => {
      expect(presentationFor(level, automatic)).toEqual({
        noteLabels,
        explanations,
        diagrams,
      });
    },
  );
});

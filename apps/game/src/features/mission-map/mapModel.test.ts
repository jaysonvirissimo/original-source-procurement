import { missionNeeds } from "@osp/curriculum";
import { describe, expect, it } from "vitest";
import { shippedCatalog } from "../curriculum/missionCatalog";
import {
  emptyPlayerState,
  type MissionProgress,
  type PlayerState,
} from "../persistence/schema";
import {
  missionProgress,
  skillEvidence,
  timestamp,
} from "../persistence/persistence.test-helpers";
import {
  mapRegions,
  missingSkills,
  missionMapModel,
  searchEntries,
} from "./mapModel";

const catalog = shippedCatalog;
const skillsById = new Map(catalog.skills.map((skill) => [skill.id, skill]));
const skillNames = new Map(
  catalog.skills.map((skill) => [skill.id, skill.name]),
);

function mission(id: string) {
  const found = catalog.missions.find((entry) => entry.id === id);
  if (found === undefined) {
    throw new Error(`No mission ${id}.`);
  }
  return found;
}

function completed(id: string, at = 1): MissionProgress {
  return missionProgress({
    missionId: id,
    sourceSavedAt: timestamp(at),
    completion: {
      count: 1,
      firstCompletedAt: timestamp(at),
      lastCompletedAt: timestamp(at),
      lastCompletionId: `completion-${id}`,
    },
  });
}

function started(id: string, at: number): MissionProgress {
  return missionProgress({ missionId: id, sourceSavedAt: timestamp(at) });
}

/** A player who completed `ids`, with evidence for every skill each one teaches. */
function playerAfter(...ids: string[]): PlayerState {
  const state = emptyPlayerState();
  for (const id of ids) {
    state.missions[id] = completed(id);
    for (const skill of mission(id).teaches) {
      state.skills[skill] = {
        evidence: [
          skillEvidence({ id: `${id}:${skill}`, skill, missionId: id }),
        ],
      };
    }
  }
  return state;
}

const idOf = (entry: { mission: { id: string } } | undefined) =>
  entry?.mission.id;

describe("missingSkills", () => {
  it("names every skill a later mission expects when nothing is introduced", () => {
    const needed = missionNeeds(mission("009"), skillsById);
    expect(needed.length).toBeGreaterThan(0);
    expect(missingSkills(mission("009"), catalog, {})).toEqual(
      needed.map((id) => ({ id, name: skillsById.get(id)?.name })),
    );
  });

  it("counts a synthesis mission's practiced skills, and clears once each is introduced", () => {
    const synthesis = mission("005");
    expect(synthesis.requires).toEqual([]);
    const needed = missionNeeds(synthesis, skillsById);
    expect(missingSkills(synthesis, catalog, {}).map(({ id }) => id)).toEqual(
      needed,
    );
    const skills = Object.fromEntries(
      needed.map((skill) => [
        skill,
        { evidence: [skillEvidence({ id: skill, skill })] },
      ]),
    );
    expect(missingSkills(synthesis, catalog, skills)).toEqual([]);
  });

  it("names a skill the catalog does not know by its ID", () => {
    expect(
      missingSkills(
        { requires: ["OSP.UNKNOWN"], teaches: [], practices: [] },
        catalog,
        {},
      ),
    ).toEqual([{ id: "OSP.UNKNOWN", name: "OSP.UNKNOWN" }]);
  });
});

describe("missionMapModel", () => {
  it("recommends the first mission on a fresh save, with nothing to resume", () => {
    const model = missionMapModel(catalog, emptyPlayerState());

    expect(idOf(model.recommended)).toBe("001");
    expect(model.entries.filter((entry) => entry.recommended)).toHaveLength(1);
    expect(model.resume).toBeUndefined();
    expect(model.completed).toBe(0);
    expect(model.total).toBe(catalog.missions.length);
    expect(model.entries.map(idOf)).toEqual(catalog.defaultPath);
  });

  it.each([
    [["001"], "002"],
    [["001", "002"], "003"],
    [["001", "002", "003", "004"], "005"],
  ])("after completing %j recommends %s", (done, next) => {
    expect(
      idOf(missionMapModel(catalog, playerAfter(...done)).recommended),
    ).toBe(next);
  });

  it("keeps recommending the path after a skip-ahead, and marks the skipped mission's missing skills", () => {
    const model = missionMapModel(catalog, playerAfter("009"));
    const skipped = model.entries.find((entry) => entry.mission.id === "009");

    expect(idOf(model.recommended)).toBe("001");
    expect(skipped?.status).toBe("complete");
    expect(skipped?.missing.length).toBeGreaterThan(0);
    expect(model.completed).toBe(1);
  });

  it("falls back to the first incomplete mission when none has its skills introduced", () => {
    const state = emptyPlayerState();
    state.missions["001"] = completed("001");

    const model = missionMapModel(catalog, state);
    expect(
      model.entries.every(
        (entry) => entry.status === "complete" || entry.missing.length > 0,
      ),
    ).toBe(true);
    expect(idOf(model.recommended)).toBe("002");
  });

  it("recommends nothing once every mission is complete", () => {
    const model = missionMapModel(catalog, playerAfter(...catalog.defaultPath));

    expect(model.recommended).toBeUndefined();
    expect(model.completed).toBe(model.total);
    expect(model.revealed).toBe(0);
    expect(model.practice).toBeUndefined();
  });

  it("counts missions only completed with the solution revealed, and offers the first for practice", () => {
    const state = playerAfter(...catalog.defaultPath);
    const reveal = (id: string, completionId: string, revealed: boolean) =>
      skillEvidence({
        id: `${completionId}:ABI.ARGUMENT`,
        completionId,
        skill: "ABI.ARGUMENT",
        missionId: id,
        kind: "real",
        hintMaxStage: revealed ? 9 : 2,
        solutionRevealed: revealed,
      });
    state.skills["ABI.ARGUMENT"] = {
      evidence: [
        reveal("F01", "f1", true),
        reveal("012", "q1", true),
        reveal("012", "q2", false),
        reveal("005", "a1", true),
      ],
    };
    const model = missionMapModel(catalog, state);

    expect(model.revealed).toBe(2);
    expect(idOf(model.practice)).toBe("005");
    expect(
      model.entries
        .filter((entry) => entry.revealedOnly)
        .map((entry) => entry.mission.id),
    ).toEqual(["005", "F01"]);
  });

  it("resumes the started mission saved most recently, preferring the earlier mission on a tie", () => {
    const state = playerAfter("001");
    state.missions["001"] = completed("001", 50);
    state.missions["003"] = started("003", 5);
    state.missions["004"] = started("004", 9);
    expect(idOf(missionMapModel(catalog, state).resume)).toBe("004");

    state.missions["003"] = started("003", 9);
    expect(idOf(missionMapModel(catalog, state).resume)).toBe("003");
  });

  it("orders missions off the recommended path after it", () => {
    const model = missionMapModel(
      { ...catalog, defaultPath: catalog.defaultPath.slice(1) },
      emptyPlayerState(),
    );

    expect(model.entries.map(idOf).at(-1)).toBe("001");
    expect(idOf(model.recommended)).toBe("001");
  });

  it("gives the same model for the same inputs", () => {
    const state = playerAfter("001", "002");
    state.missions["006"] = started("006", 3);
    expect(missionMapModel(catalog, state)).toEqual(
      missionMapModel(catalog, structuredClone(state)),
    );
  });
});

describe("mapRegions", () => {
  it("groups training missions into phase lanes and always adds field and live regions", () => {
    const { entries } = missionMapModel(catalog, emptyPlayerState());
    const regions = mapRegions(entries);

    expect(regions.map(({ kind, title }) => [kind, title])).toEqual([
      ["phase", "Translation"],
      ["phase", "Memory"],
      ["phase", "Types and layout"],
      ["phase", "Arithmetic"],
      ["phase", "Memory widths"],
      ["phase", "Conditions"],
      ["phase", "Branches"],
      ["phase", "Loops"],
      ["phase", "Functions"],
      ["field", "Field"],
      ["live", "Live"],
    ]);
    expect(regions.flatMap((region) => region.entries.map(idOf))).toEqual(
      catalog.defaultPath,
    );
  });

  it("puts field and live missions in their regions", () => {
    const { entries } = missionMapModel(catalog, emptyPlayerState());
    const [first, second, ...rest] = entries;
    if (first === undefined || second === undefined) {
      throw new Error("The catalog needs two missions.");
    }
    const regions = mapRegions([
      { ...first, tier: "field" },
      { ...second, tier: "live" },
      ...rest,
    ]);

    expect(
      regions.find((region) => region.kind === "field")?.entries.map(idOf),
    ).toEqual(["001", "F04", "F01", "F02", "F03"]);
    expect(
      regions.find((region) => region.kind === "live")?.entries.map(idOf),
    ).toEqual(["002"]);
  });
});

describe("searchEntries", () => {
  const { entries } = missionMapModel(catalog, emptyPlayerState());
  const search = (query: string) =>
    searchEntries(entries, query, skillNames).map(idOf);

  it("matches every word against the ID, title, and phase, ignoring case", () => {
    expect(search("field offset")).toEqual(["009"]);
    expect(search("  FIELD   Offset ")).toEqual(["009"]);
    expect(search("012")).toEqual(["012", "012A", "012B", "012C", "012D"]);
    expect(search("memory")).toEqual(
      entries
        .filter((entry) => entry.mission.phase.toLowerCase().includes("memory"))
        .map(idOf),
    );
    expect(search("no such mission")).toEqual([]);
  });

  it("matches learner-facing skill names", () => {
    const skill = mission("003").teaches[0];
    const name = skill === undefined ? undefined : skillNames.get(skill);
    if (name === undefined) {
      throw new Error("003 teaches a named skill.");
    }
    expect(search(name)).toContain("003");
  });

  it("matches a skill by its ID when it has no learner-facing name", () => {
    expect(searchEntries(entries, "abi.return", new Map()).map(idOf)).toContain(
      "001",
    );
  });

  it("keeps every entry for a blank query", () => {
    expect(search("   ")).toEqual(entries.map(idOf));
  });
});

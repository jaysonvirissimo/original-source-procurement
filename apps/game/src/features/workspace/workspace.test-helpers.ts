import { missions } from "@osp/curriculum";
import type { Mission } from "@osp/mission-schema";
import type { AssembledObject, BuildOutcome } from "../compiler/types";
import {
  missionMatchTarget,
  missionResultFrom,
  type BuildRequest,
  type MissionResult,
} from "./missionResult";

export function shippedMission(id: string): Mission {
  const mission = missions.find((entry) => entry.id === id);
  if (mission === undefined) {
    throw new Error(`The curriculum has no mission ${id}.`);
  }
  return mission;
}

export function inlineWords(mission: Mission): readonly number[] {
  if (mission.target.kind !== "inline") {
    throw new Error(`Mission ${mission.id} has no inline target.`);
  }
  return mission.target.words;
}

/** An assembled object defining one function, without relocations. */
export function objectWith(
  name: string,
  words: readonly number[],
): AssembledObject {
  return {
    info: { aspsxVersion: "2.77", gpSize: 0, partialDivExpansion: false },
    sections: [
      {
        name: ".text",
        kind: "code",
        bytes: new Uint8Array(words.length * 4),
        size: words.length * 4,
        words: Uint32Array.from(words),
        relocations: [],
        provenance: words.map(() => ({ line: 1, kind: "instruction" })),
      },
    ],
    symbols: [],
    functions:
      words.length === 0
        ? []
        : [{ name, section: ".text", start: 0, end: words.length }],
    smallData: [],
  };
}

export function successWith(object: AssembledObject): BuildOutcome {
  return { kind: "success", object, compilerText: "", diagnostics: [] };
}

export function request(
  mission: Mission,
  buildId: number,
  sourceSha256 = "a".repeat(64),
): BuildRequest {
  return { missionId: mission.id, buildId, sourceSha256 };
}

/**
 * A matched result for the mission: its own target words when `exact`, and
 * the target with its last word zeroed otherwise.
 */
export function matchedResult(
  mission: Mission,
  buildRequest: BuildRequest,
  exact = true,
): MissionResult {
  const target = missionMatchTarget(mission);
  if (target === undefined) {
    throw new Error(`Mission ${mission.id} has no inline target.`);
  }
  const words = [...inlineWords(mission)];
  if (!exact) {
    words[words.length - 1] = 0;
  }
  return missionResultFrom(
    buildRequest,
    successWith(objectWith(mission.symbol, words)),
    mission.symbol,
    target,
  );
}

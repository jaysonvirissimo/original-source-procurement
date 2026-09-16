import type { InlineTarget, Mission } from "@osp/mission-schema";
import type { MissionDraft } from "./missions/authoring.ts";
import { missionDrafts } from "./missions/drafts.ts";
import { target as target001 } from "./missions/targets/001.ts";
import { target as target002 } from "./missions/targets/002.ts";
import { target as target003 } from "./missions/targets/003.ts";
import { target as target004 } from "./missions/targets/004.ts";
import { target as target005 } from "./missions/targets/005.ts";
import { target as target006 } from "./missions/targets/006.ts";
import { target as target007 } from "./missions/targets/007.ts";
import { target as target008 } from "./missions/targets/008.ts";
import { target as target009 } from "./missions/targets/009.ts";
import { target as target010 } from "./missions/targets/010.ts";
import { target as target011 } from "./missions/targets/011.ts";
import { target as target011A } from "./missions/targets/011A.ts";
import { target as target011B } from "./missions/targets/011B.ts";
import { target as target012 } from "./missions/targets/012.ts";
import { target as target012A } from "./missions/targets/012A.ts";
import { target as target012B } from "./missions/targets/012B.ts";
import { target as target012C } from "./missions/targets/012C.ts";
import { target as target012D } from "./missions/targets/012D.ts";

/** Targets generated from each synthetic mission's solution, by mission ID. */
const generatedTargets: Readonly<Record<string, InlineTarget>> = {
  "001": target001,
  "002": target002,
  "003": target003,
  "004": target004,
  "005": target005,
  "006": target006,
  "007": target007,
  "008": target008,
  "009": target009,
  "010": target010,
  "011": target011,
  "011A": target011A,
  "011B": target011B,
  "012": target012,
  "012A": target012A,
  "012B": target012B,
  "012C": target012C,
  "012D": target012D,
};

export function withTarget(
  draft: MissionDraft,
  targets: Readonly<Record<string, InlineTarget>>,
): Mission {
  const target = targets[draft.id];
  if (target === undefined) {
    throw new Error(
      `Mission ${draft.id} has no generated target. Run pnpm curriculum:targets.`,
    );
  }
  return { ...draft, target };
}

/** Mission definitions, each with the target generated from its solution. */
export const missions: readonly Mission[] = missionDrafts.map((draft) =>
  withTarget(draft, generatedTargets),
);

/**
 * The recommended mission order. Prerequisites remain the source of truth:
 * validation requires every mission on this path to be completable with
 * skills taught earlier on it.
 */
export const defaultPath: readonly string[] = [
  "001",
  "002",
  "003",
  "004",
  "005",
  "006",
  "007",
  "008",
  "009",
  "010",
  "011",
  "011A",
  "011B",
  "012",
  "012A",
  "012B",
  "012C",
  "012D",
  "F01",
];

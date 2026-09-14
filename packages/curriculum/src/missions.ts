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
import { target as target012 } from "./missions/targets/012.ts";

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
  "012": target012,
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
  "012",
];

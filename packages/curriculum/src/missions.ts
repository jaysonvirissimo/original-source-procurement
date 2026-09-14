import type { InlineTarget, Mission } from "@osp/mission-schema";
import type { MissionDraft } from "./missions/authoring.ts";
import { missionDrafts } from "./missions/drafts.ts";
import { target as target001 } from "./missions/targets/001.ts";
import { target as target002 } from "./missions/targets/002.ts";
import { target as target003 } from "./missions/targets/003.ts";

/** Targets generated from each synthetic mission's solution, by mission ID. */
const generatedTargets: Readonly<Record<string, InlineTarget>> = {
  "001": target001,
  "002": target002,
  "003": target003,
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
export const defaultPath: readonly string[] = ["001", "002", "003"];

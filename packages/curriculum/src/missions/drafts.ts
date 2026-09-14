import { returnPath } from "./001-return-path.ts";
import { argumentZero } from "./002-argument-zero.ts";
import { addImmediate } from "./003-add-immediate.ts";
import type { MissionDraft } from "./authoring.ts";

export type { MissionDraft } from "./authoring.ts";

/**
 * Every synthetic mission before its target is attached. The target
 * generator reads these, so this module never imports generated targets.
 */
export const missionDrafts: readonly MissionDraft[] = [
  returnPath,
  argumentZero,
  addImmediate,
];

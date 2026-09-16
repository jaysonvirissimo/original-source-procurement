import { returnPath } from "./001-return-path.ts";
import { argumentZero } from "./002-argument-zero.ts";
import { addImmediate } from "./003-add-immediate.ts";
import { shiftLeft } from "./004-shift-left.ts";
import { scaleCheck } from "./005-scale-check.ts";
import { loadWord } from "./006-load-word.ts";
import { dereference } from "./007-dereference.ts";
import { storeWord } from "./008-store-word.ts";
import { fieldOffset } from "./009-field-offset.ts";
import { signedByte } from "./010-signed-byte.ts";
import { wrongSign } from "./011-wrong-sign.ts";
import { arrayLayout } from "./011A-array-layout.ts";
import { pointerInStruct } from "./011B-pointer-in-struct.ts";
import { qualification01 } from "./012-qualification-01.ts";
import { halfWidth } from "./012A-half-width.ts";
import { padding } from "./012B-padding.ts";
import { pointerStep } from "./012C-pointer-step.ts";
import { typeNames } from "./012D-type-names.ts";
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
  shiftLeft,
  scaleCheck,
  loadWord,
  dereference,
  storeWord,
  fieldOffset,
  signedByte,
  wrongSign,
  arrayLayout,
  pointerInStruct,
  qualification01,
  halfWidth,
  padding,
  pointerStep,
  typeNames,
];

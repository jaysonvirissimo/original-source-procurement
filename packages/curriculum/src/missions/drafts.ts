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
import { qualification02 } from "./013-qualification-02.ts";
import { addRegisters } from "./014-add-registers.ts";
import { subtractRegisters } from "./015-subtract-registers.ts";
import { borrowedRegister } from "./016-borrowed-register.ts";
import { lowBits } from "./017-low-bits.ts";
import { qualification03 } from "./018-qualification-03.ts";
import { unsignedHalf } from "./019-unsigned-half.ts";
import { halfSign } from "./020-half-sign.ts";
import { narrowStore } from "./021-narrow-store.ts";
import { shiftRight } from "./022-shift-right.ts";
import { staticStorage } from "./023-static-storage.ts";
import { qualification04 } from "./024-qualification-04.ts";
import { lessThan } from "./025-less-than.ts";
import { unsignedTest } from "./026-unsigned-test.ts";
import { otherWayRound } from "./027-other-way-round.ts";
import { orEqual } from "./028-or-equal.ts";
import { signBit } from "./029-sign-bit.ts";
import { qualification05 } from "./030-qualification-05.ts";
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
  qualification02,
  addRegisters,
  subtractRegisters,
  borrowedRegister,
  lowBits,
  qualification03,
  unsignedHalf,
  halfSign,
  narrowStore,
  shiftRight,
  staticStorage,
  qualification04,
  lessThan,
  unsignedTest,
  otherWayRound,
  orEqual,
  signBit,
  qualification05,
];

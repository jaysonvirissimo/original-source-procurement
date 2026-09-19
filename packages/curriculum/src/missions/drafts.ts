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
import { branchOnTest } from "./031-branch-on-test.ts";
import { branchOnSign } from "./032-branch-on-sign.ts";
import { theSlotRuns } from "./033-the-slot-runs.ts";
import { eitherWayRound } from "./034-either-way-round.ts";
import { qualification06 } from "./035-qualification-06.ts";
import { goAroundAgain } from "./036-go-around-again.ts";
import { theGuard } from "./037-the-guard.ts";
import { takeItBack } from "./038-take-it-back.ts";
import { noMultiply } from "./039-no-multiply.ts";
import { jumpOver } from "./040-jump-over.ts";
import { qualification07 } from "./041-qualification-07.ts";
import { makeACall } from "./042-make-a-call.ts";
import { theFrame } from "./043-the-frame.ts";
import { fifthArgument } from "./044-fifth-argument.ts";
import { keepIt } from "./045-keep-it.ts";
import { putItBack } from "./046-put-it-back.ts";
import { scratch } from "./047-scratch.ts";
import { qualification08 } from "./048-qualification-08.ts";
import { qualification09 } from "./049-qualification-09.ts";
import { qualification10 } from "./050-qualification-10.ts";
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
  branchOnTest,
  branchOnSign,
  theSlotRuns,
  eitherWayRound,
  qualification06,
  goAroundAgain,
  theGuard,
  takeItBack,
  noMultiply,
  jumpOver,
  qualification07,
  makeACall,
  theFrame,
  fifthArgument,
  keepIt,
  putItBack,
  scratch,
  qualification08,
  qualification09,
  qualification10,
];

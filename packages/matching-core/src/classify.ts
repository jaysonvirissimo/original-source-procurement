import { decode, format, type Instruction } from "psyq-asm";
import type { AlignedRow } from "./align.ts";
import { at } from "./at.ts";
import {
  LOAD_FORMS,
  STORE_BYTES,
  transfersControl,
  type Decoded,
} from "./classes.ts";
import type { RelocationFinding } from "./relocations.ts";
import type {
  GeneratedWord,
  InstructionRange,
  Mismatch,
  MismatchKind,
} from "./types.ts";

/** A mismatch with the alignment rows it covers. */
export interface DraftMismatch extends Mismatch {
  readonly rows: readonly number[];
}

export function mismatchId(
  kind: MismatchKind,
  targetRange: InstructionRange,
  generatedRange: InstructionRange,
): string {
  return `${kind}@t${String(targetRange.start)}g${String(generatedRange.start)}`;
}

function draft(
  kind: MismatchKind,
  targetRange: InstructionRange,
  generatedRange: InstructionRange,
  rows: readonly number[],
  evidence: readonly string[],
): DraftMismatch {
  return {
    id: mismatchId(kind, targetRange, generatedRange),
    kind,
    targetRange,
    generatedRange,
    confidence: kind === "UNKNOWN" ? 0 : 1,
    evidence,
    rows,
  };
}

export function text(instruction: Decoded): string {
  return format(instruction, { pseudo: true });
}

function hex(word: number): string {
  return `0x${word.toString(16).padStart(8, "0")}`;
}

interface OperandFields {
  readonly registers: readonly string[];
  readonly immediates: readonly number[];
  readonly offsets: readonly number[];
  readonly displacements: readonly number[];
}

function operandFields(instruction: Instruction): OperandFields {
  const registers: string[] = [];
  const immediates: number[] = [];
  const offsets: number[] = [];
  const displacements: number[] = [];
  for (const operand of instruction.operands) {
    switch (operand.kind) {
      case "gpr":
        registers.push(`gpr${String(operand.number)}`);
        break;
      case "cop":
        registers.push(
          `cop${String(operand.unit)}${operand.space}${String(operand.number)}`,
        );
        break;
      case "imm":
      case "shamt":
        immediates.push(operand.value);
        break;
      case "mem":
        registers.push(`gpr${String(operand.base)}`);
        offsets.push(operand.offset);
        break;
      case "branch":
        displacements.push(operand.displacement);
        break;
      case "target":
        displacements.push(operand.index);
        break;
    }
  }
  return { registers, immediates, offsets, displacements };
}

function differs(first: readonly unknown[], second: readonly unknown[]) {
  return JSON.stringify(first) !== JSON.stringify(second);
}

/** Operand differences between two instructions with the same operand shape. */
function operandKinds(
  target: Instruction,
  generated: Instruction,
  shown: string,
): [MismatchKind, string][] {
  const expected = operandFields(target);
  const actual = operandFields(generated);
  const kinds: [MismatchKind, string][] = [];
  if (differs(expected.registers, actual.registers)) {
    kinds.push(["REGISTER", `Registers differ. ${shown}`]);
  }
  if (differs(expected.immediates, actual.immediates)) {
    kinds.push(["IMMEDIATE", `Immediate values differ. ${shown}`]);
  }
  if (differs(expected.offsets, actual.offsets)) {
    kinds.push(["MEMORY_OFFSET", `Memory offsets differ. ${shown}`]);
  }
  if (differs(expected.displacements, actual.displacements)) {
    kinds.push(["UNKNOWN", `Branch or jump targets differ. ${shown}`]);
  }
  return kinds;
}

function accessKind(
  target: Instruction,
  generated: Instruction,
): [MismatchKind, string] | undefined {
  const expectedLoad = LOAD_FORMS.get(target.mnemonic);
  const actualLoad = LOAD_FORMS.get(generated.mnemonic);
  if (expectedLoad !== undefined && actualLoad !== undefined) {
    const uses = `Target uses ${target.mnemonic}; your output uses ${generated.mnemonic}.`;
    return expectedLoad.bytes === actualLoad.bytes
      ? [
          "LOAD_SIGNEDNESS",
          `${uses} Check the signedness of this ${String(expectedLoad.bytes * 8)}-bit value.`,
        ]
      : ["LOAD_WIDTH", `${uses} Check the width of this value.`];
  }
  const expectedStore = STORE_BYTES.get(target.mnemonic);
  const actualStore = STORE_BYTES.get(generated.mnemonic);
  if (expectedStore !== undefined && actualStore !== undefined) {
    return [
      "STORE_WIDTH",
      `Target uses ${target.mnemonic}; your output uses ${generated.mnemonic}. Check the width of this value.`,
    ];
  }
  return undefined;
}

/** Classifies two aligned words that differ outside their relocated fields. */
function pairMismatches(
  row: number,
  target: number,
  generated: GeneratedWord,
  targetIndex: number,
  generatedIndex: number,
  delaySlot: boolean,
): DraftMismatch[] {
  const expected = decode(target);
  const actual = decode(generated.word);
  const shown = `Target: ${text(expected)}; yours: ${text(actual)}.`;
  const make = (kind: MismatchKind, evidence: readonly string[]) =>
    draft(
      kind,
      { start: targetIndex, end: targetIndex + 1 },
      { start: generatedIndex, end: generatedIndex + 1 },
      [row],
      evidence,
    );

  // A changed instruction in a delay slot is classified by its operands; only
  // a slot that one side fills and the other leaves empty is DELAY_SLOT.
  if (delaySlot && (target === 0 || generated.word === 0)) {
    return [make("DELAY_SLOT", [`One delay slot is empty. ${shown}`])];
  }
  if (expected.mnemonic === ".word" || actual.mnemonic === ".word") {
    return [
      make("UNKNOWN", [
        shown,
        `Words: target ${hex(target)}, yours ${hex(generated.word)}.`,
      ]),
    ];
  }

  const kinds: [MismatchKind, string][] = [];
  if (expected.mnemonic !== actual.mnemonic) {
    const access = accessKind(expected, actual);
    if (access === undefined) {
      return [
        // Only the formatted instructions name the operation, so aliases
        // such as move for addu read the same as the listing.
        make("OPCODE", [`The instructions differ. ${shown}`]),
      ];
    }
    kinds.push(access);
  }
  kinds.push(...operandKinds(expected, actual, shown));
  // Unreachable while decode rejects reserved bits, so equal operands mean
  // equal words. Kept so a decoder change can never drop a difference.
  if (kinds.length === 0) {
    kinds.push([
      "UNKNOWN",
      `The words differ in bits no operand shows: target ${hex(target)}, yours ${hex(generated.word)}.`,
    ]);
  }

  return kinds.map(([kind, evidence]) => make(kind, [evidence]));
}

function rowInstruction(
  row: AlignedRow,
  target: readonly number[],
  generated: readonly GeneratedWord[],
): Decoded {
  return decode(
    row.status === "inserted"
      ? at(generated, row.generated).word
      : at(target, row.target),
  );
}

function followsControlTransfer(
  rows: readonly AlignedRow[],
  index: number,
  target: readonly number[],
  generated: readonly GeneratedWord[],
): boolean {
  return (
    index > 0 &&
    transfersControl(rowInstruction(at(rows, index - 1), target, generated))
  );
}

interface Position {
  readonly target: number;
  readonly generated: number;
}

/** Target and generated words before each row. */
function positions(rows: readonly AlignedRow[]): Position[] {
  let target = 0;
  let generated = 0;
  return rows.map((row) => {
    const position = { target, generated };
    if (row.status !== "inserted") {
      target += 1;
    }
    if (row.status !== "deleted") {
      generated += 1;
    }
    return position;
  });
}

function gapMismatch(
  rows: readonly AlignedRow[],
  first: number,
  end: number,
  position: Position,
  target: readonly number[],
  generated: readonly GeneratedWord[],
): DraftMismatch {
  const count = end - first;
  const covered = Array.from({ length: count }, (_, offset) => first + offset);
  const delaySlot = followsControlTransfer(rows, first, target, generated);
  if (at(rows, first).status === "inserted") {
    const evidence = covered.flatMap((index) => {
      const word = at(generated, position.generated + index - first);
      const note =
        word.origin?.note === undefined
          ? []
          : [`${word.origin.kind}: ${word.origin.note}.`];
      return [
        `Your output has ${text(decode(word.word))} here; the target does not.`,
        ...note,
      ];
    });
    return draft(
      delaySlot ? "DELAY_SLOT" : "EXTRA_INSTRUCTION",
      { start: position.target, end: position.target },
      { start: position.generated, end: position.generated + count },
      covered,
      evidence,
    );
  }
  return draft(
    delaySlot ? "DELAY_SLOT" : "MISSING_INSTRUCTION",
    { start: position.target, end: position.target + count },
    { start: position.generated, end: position.generated },
    covered,
    covered.map(
      (index) =>
        `The target has ${text(decode(at(target, position.target + index - first)))} here; your output does not.`,
    ),
  );
}

function relocationMismatch(
  finding: RelocationFinding,
  rows: readonly AlignedRow[],
  target: readonly number[],
  generated: readonly GeneratedWord[],
): DraftMismatch {
  const word = finding.offset / 4;
  const generatedRow = rows.findIndex(
    (row) => row.status !== "deleted" && row.generated === word,
  );
  const row =
    generatedRow === -1
      ? rows.findIndex(
          (item) => item.status !== "inserted" && item.target === word,
        )
      : generatedRow;
  const range = (length: number) =>
    word < length
      ? { start: word, end: word + 1 }
      : { start: length, end: length };
  return draft(
    "RELOCATION_TARGET",
    range(target.length),
    range(generated.length),
    [row],
    finding.evidence,
  );
}

/** Turns an alignment into base mismatches, in row order. */
export function classify(
  rows: readonly AlignedRow[],
  target: readonly number[],
  generated: readonly GeneratedWord[],
  relocationFindings: readonly RelocationFinding[],
): DraftMismatch[] {
  const before = positions(rows);
  const mismatches: DraftMismatch[] = [];
  let index = 0;
  while (index < rows.length) {
    const row = at(rows, index);
    if (row.status === "inserted" || row.status === "deleted") {
      let end = index + 1;
      while (end < rows.length && at(rows, end).status === row.status) {
        end += 1;
      }
      mismatches.push(
        gapMismatch(rows, index, end, at(before, index), target, generated),
      );
      index = end;
      continue;
    }
    if (row.status === "different") {
      mismatches.push(
        ...pairMismatches(
          index,
          at(target, row.target),
          at(generated, row.generated),
          row.target,
          row.generated,
          followsControlTransfer(rows, index, target, generated),
        ),
      );
    }
    index += 1;
  }
  return [
    ...mismatches,
    ...relocationFindings.map((finding) =>
      relocationMismatch(finding, rows, target, generated),
    ),
  ];
}

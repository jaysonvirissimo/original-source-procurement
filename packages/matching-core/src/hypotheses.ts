import { wordFacts, type MemoryAccess, type WordFacts } from "./scan.ts";
import { at } from "./at.ts";
import type { InstructionRange, MatchResult, Mismatch } from "./types.ts";

/**
 * Likely source causes, layered over base mismatches. Only some have rules;
 * the rest are reserved names.
 */
export const TEACHING_HYPOTHESIS_KINDS = [
  "LIKELY_SIGNEDNESS",
  "LIKELY_INTEGER_WIDTH",
  "LIKELY_STRUCT_FIELD_TYPE",
  "LIKELY_TEMPORARY_LIFETIME",
  "LIKELY_CONTEXT_MISMATCH",
  "LIKELY_EXPRESSION_SHAPE",
  "LIKELY_STACK_FRAME",
  "LIKELY_REGISTER_ALLOCATION",
  "LIKELY_CONTROL_FLOW",
] as const;
export type TeachingHypothesisKind = (typeof TEACHING_HYPOTHESIS_KINDS)[number];

/**
 * A possible source cause. The message is always phrased as a hypothesis,
 * never as a certain change, and never reveals a solution.
 */
export interface TeachingHypothesis {
  readonly kind: TeachingHypothesisKind;
  readonly confidence: number;
  readonly message: string;
  readonly evidenceMismatchIds: readonly string[];
}

/** Every hypothesis message contains one of these words. */
export const HYPOTHESIS_HEDGE = /\b(check|may|likely)\b/i;

const WIDTH_KINDS: ReadonlySet<Mismatch["kind"]> = new Set([
  "LOAD_WIDTH",
  "STORE_WIDTH",
]);

/** Bases whose offsets name stack slots or small data, not structure fields. */
const NON_FIELD_BASES: ReadonlySet<string> = new Set(["$sp", "$gp"]);

function hypothesis(
  kind: TeachingHypothesisKind,
  confidence: number,
  message: string,
  evidenceMismatchIds: readonly string[],
): TeachingHypothesis {
  return { kind, confidence, message, evidenceMismatchIds };
}

function indexes(range: InstructionRange): number[] {
  return Array.from(
    { length: range.end - range.start },
    (_, offset) => range.start + offset,
  );
}

function bits(access: MemoryAccess): string {
  return `${String(access.bytes * 8)}-bit`;
}

function signedness(id: string, expected: MemoryAccess): TeachingHypothesis {
  const plainChar =
    expected.bytes === 1 ? " In PsyQ, plain char is unsigned." : "";
  return hypothesis(
    "LIKELY_SIGNEDNESS",
    0.8,
    expected.signed === true
      ? `The target sign-extends this ${bits(expected)} value; your output does not. The value is likely declared signed in the target.${plainChar}`
      : `The target zero-extends this ${bits(expected)} value; your output sign-extends it. The value is likely declared unsigned in the target.${plainChar}`,
    [id],
  );
}

function width(
  id: string,
  expected: MemoryAccess,
  actual: MemoryAccess,
): TeachingHypothesis {
  const verb = expected.kind === "load" ? "reads" : "writes";
  return hypothesis(
    "LIKELY_INTEGER_WIDTH",
    0.7,
    `The target ${verb} a ${bits(expected)} value here; your output ${verb} a ${bits(actual)} value. The value's type likely has a different width; check its declaration.`,
    [id],
  );
}

function structField(id: string, expected: MemoryAccess): TeachingHypothesis {
  return hypothesis(
    "LIKELY_STRUCT_FIELD_TYPE",
    0.5,
    `This access uses offset 0x${expected.offset.toString(16)} from ${expected.base}, which may be a structure field. Check that field's declared type.`,
    [id],
  );
}

/** Hypotheses about one changed memory access. */
function accessHypotheses(
  mismatch: Mismatch,
  expected: MemoryAccess,
  actual: MemoryAccess,
): TeachingHypothesis[] {
  const typed =
    mismatch.kind === "LOAD_SIGNEDNESS"
      ? [signedness(mismatch.id, expected)]
      : WIDTH_KINDS.has(mismatch.kind)
        ? [width(mismatch.id, expected, actual)]
        : [];
  const field =
    typed.length > 0 &&
    !NON_FIELD_BASES.has(expected.base) &&
    expected.offset !== 0;
  return field ? [...typed, structField(mismatch.id, expected)] : typed;
}

/**
 * The target loads through a register while your output copies that same
 * register into the load's destination: the source likely uses a pointer
 * where the target uses the value it points to.
 */
function addressForValue(
  mismatches: readonly Mismatch[],
  targetFacts: readonly WordFacts[],
  generatedFacts: readonly WordFacts[],
): TeachingHypothesis[] {
  const copies = mismatches.flatMap((mismatch) =>
    indexes(mismatch.generatedRange)
      .map((index) => ({ mismatch, facts: at(generatedFacts, index) }))
      .filter(
        ({ facts }) =>
          facts.memory === undefined &&
          facts.writes.length === 1 &&
          facts.reads.length === 1,
      ),
  );
  return mismatches.flatMap((mismatch) =>
    indexes(mismatch.targetRange).flatMap((index) => {
      const load = at(targetFacts, index).memory;
      if (load?.kind !== "load") {
        return [];
      }
      const copy = copies.find(
        ({ facts }) =>
          facts.writes[0] === load.register && facts.reads[0] === load.base,
      );
      if (copy === undefined) {
        return [];
      }
      return [
        hypothesis(
          "LIKELY_EXPRESSION_SHAPE",
          0.6,
          `The target reads the value stored at the address in ${load.base}; your output copies that address into ${load.register} instead. The source may use the pointer itself where the target uses the value it points to. Check for a missing dereference.`,
          [...new Set([mismatch.id, copy.mismatch.id])],
        ),
      ];
    }),
  );
}

/**
 * Likely source causes for a comparison's mismatches. Each hypothesis cites
 * the mismatches it rests on. An exact result has none.
 */
export function teachingHypotheses(result: MatchResult): TeachingHypothesis[] {
  const targetFacts = wordFacts(result.target.map((word) => word.word));
  const generatedFacts = wordFacts(result.generated.map((word) => word.word));
  const accesses = result.mismatches.flatMap((mismatch) => {
    const expected = targetFacts[mismatch.targetRange.start]?.memory;
    const actual = generatedFacts[mismatch.generatedRange.start]?.memory;
    return expected !== undefined && actual !== undefined
      ? accessHypotheses(mismatch, expected, actual)
      : [];
  });
  return [
    ...accesses,
    ...addressForValue(result.mismatches, targetFacts, generatedFacts),
  ];
}

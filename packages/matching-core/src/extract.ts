import type { AssembledObject, WordOrigin } from "psyq-asm";
import type { FunctionRelocation, GeneratedFunction } from "./types.ts";

/** Names of every function the object defines, in order. */
export function definedFunctions(object: AssembledObject): string[] {
  return object.functions.map((entry) => entry.name);
}

/**
 * Builds a generated function from its words, its function-relative
 * relocations, and its per-word provenance.
 */
export function functionFromWords(
  name: string,
  words: ArrayLike<number>,
  relocations: readonly FunctionRelocation[] = [],
  provenance: readonly WordOrigin[] = [],
): GeneratedFunction {
  return {
    name,
    words: Array.from(words, (word, index) => ({
      word: word >>> 0,
      mask: relocations.reduce(
        (mask, relocation) =>
          relocation.offset === index * 4
            ? (mask | relocation.fieldMask) >>> 0
            : mask,
        0,
      ),
      origin: provenance[index],
    })),
    relocations,
  };
}

/**
 * Extracts one function's words, relocations, and provenance from an
 * assembled object. Returns undefined when the object defines no function
 * with that name.
 */
export function extractFunction(
  object: AssembledObject,
  symbol: string,
): GeneratedFunction | undefined {
  const range = object.functions.find((entry) => entry.name === symbol);
  if (range === undefined) {
    return undefined;
  }
  const section = object.sections.find(
    (candidate) => candidate.name === range.section,
  );
  const start = range.start * 4;
  const end = range.end * 4;
  const relocations = (section?.relocations ?? [])
    .filter(
      (relocation) => relocation.offset >= start && relocation.offset < end,
    )
    .map((relocation) => ({
      offset: relocation.offset - start,
      kind: relocation.kind,
      fieldMask: relocation.fieldMask,
      fieldValue: relocation.fieldValue,
      target: relocation.target,
    }));
  return functionFromWords(
    symbol,
    section?.words?.subarray(range.start, range.end) ?? [],
    relocations,
    section?.provenance?.slice(range.start, range.end) ?? [],
  );
}

import type { FunctionRelocation, RelocationTargetIdentity } from "./types.ts";

export interface RelocationFinding {
  /** Bytes from the function's first word. */
  readonly offset: number;
  readonly evidence: readonly string[];
}

function describeTarget(target: RelocationTargetIdentity): string {
  if (target.kind === "section") {
    return `${target.section}+0x${target.offset.toString(16)}`;
  }
  if (target.addend === 0) {
    return target.name;
  }
  const sign = target.addend > 0 ? "+" : "-";
  return `${target.name}${sign}${String(Math.abs(target.addend))}`;
}

/** Kind and target identity, which is everything the comparison uses. */
export function describeRelocation(relocation: FunctionRelocation): string {
  return `${relocation.kind} ${describeTarget(relocation.target)}`;
}

function describedAt(
  relocations: readonly FunctionRelocation[],
  offset: number,
): string[] {
  return relocations
    .filter((relocation) => relocation.offset === offset)
    .map(describeRelocation)
    .sort();
}

/** Items of `first` left over after removing one match per item of `second`. */
function without(first: readonly string[], second: readonly string[]) {
  const remaining = [...second];
  return first.filter((item) => {
    const index = remaining.indexOf(item);
    if (index === -1) {
      return true;
    }
    remaining.splice(index, 1);
    return false;
  });
}

/**
 * Compares relocations by function-relative offset. Both sides need the same
 * relocations at each offset: equal kind and equal target, including the
 * addend.
 */
export function compareRelocations(
  generated: readonly FunctionRelocation[],
  target: readonly FunctionRelocation[],
): RelocationFinding[] {
  const offsets = [
    ...new Set([...target, ...generated].map((item) => item.offset)),
  ].sort((a, b) => a - b);
  return offsets.flatMap((offset) => {
    const expected = describedAt(target, offset);
    const actual = describedAt(generated, offset);
    const evidence = [
      ...without(expected, actual).map(
        (item) => `Target relocates ${item} here; your output does not.`,
      ),
      ...without(actual, expected).map(
        (item) => `Your output relocates ${item} here; the target does not.`,
      ),
    ];
    return evidence.length === 0 ? [] : [{ offset, evidence }];
  });
}

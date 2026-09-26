import type { FunctionRelocation, RelocationTargetIdentity } from "./types.ts";

export interface RelocationFinding {
  /** Bytes from the function's first word. */
  readonly offset: number;
  /**
   * The target word, when it is not the word at `offset`. A linked call is
   * compared on an aligned row, so the two can differ.
   */
  readonly targetWord?: number;
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

function sortedAt(
  relocations: readonly FunctionRelocation[],
  offset: number,
): FunctionRelocation[] {
  return relocations
    .filter((relocation) => relocation.offset === offset)
    .map((relocation) => ({ relocation, key: describeRelocation(relocation) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ relocation }) => relocation);
}

/** How the player reads what a relocation does, without its kind's name. */
function phrase(
  relocation: FunctionRelocation,
  calls: ReadonlySet<number>,
): string {
  const { target } = relocation;
  const name =
    target.kind === "section" && target.label !== undefined
      ? target.label
      : describeTarget(target);
  switch (relocation.kind) {
    case "MIPS26":
      return calls.has(relocation.offset)
        ? `calls ${name}`
        : `jumps to ${name}`;
    case "HI16":
      return `fills in the upper half of the address of ${name}`;
    case "LO16":
      return `fills in the lower half of the address of ${name}`;
    case "GPREL16":
      return `reaches ${name} through $gp`;
    case "WORD32":
      return `holds the address of ${name}`;
  }
}

/** Items of `first` left over after removing one match per item of `second`. */
function without(
  first: readonly FunctionRelocation[],
  second: readonly FunctionRelocation[],
): FunctionRelocation[] {
  const remaining = second.map(describeRelocation);
  return first.filter((item) => {
    const index = remaining.indexOf(describeRelocation(item));
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
 * addend. `calls` holds the offsets of the generated `jal` words, so a
 * different callee reads as a call rather than a relocation.
 */
export function compareRelocations(
  generated: readonly FunctionRelocation[],
  target: readonly FunctionRelocation[],
  calls: ReadonlySet<number> = new Set(),
): RelocationFinding[] {
  const offsets = [
    ...new Set([...target, ...generated].map((item) => item.offset)),
  ].sort((a, b) => a - b);
  return offsets.flatMap((offset) => {
    const expected = sortedAt(target, offset);
    const actual = sortedAt(generated, offset);
    const missing = without(expected, actual);
    const extra = without(actual, expected);
    const [onlyMissing] = missing;
    const [onlyExtra] = extra;
    if (
      missing.length === 1 &&
      extra.length === 1 &&
      onlyMissing?.kind === onlyExtra?.kind &&
      onlyMissing !== undefined &&
      onlyExtra !== undefined
    ) {
      return [
        {
          offset,
          evidence: [
            `The target ${phrase(onlyMissing, calls)} here; your output ${phrase(onlyExtra, calls)}.`,
          ],
        },
      ];
    }
    const evidence = [
      ...missing.map(
        (item) =>
          `The target ${phrase(item, calls)} here; your output does not.`,
      ),
      ...extra.map(
        (item) =>
          `Your output ${phrase(item, calls)} here; the target does not.`,
      ),
    ];
    return evidence.length === 0 ? [] : [{ offset, evidence }];
  });
}

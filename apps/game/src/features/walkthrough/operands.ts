import type { BranchTest, JumpTarget, WordFacts } from "@osp/matching-core";
import { hex } from "../scan/format";

/** One labeled part of an instruction's operands. */
export interface OperandPart {
  readonly role: string;
  readonly value: string;
  readonly meaning: string;
}

export interface OperandReading {
  readonly parts: readonly OperandPart[];
  /** The whole instruction read aloud. */
  readonly summary: string;
}

/**
 * The operands of a load, a store, a branch or a jump, labeled from decoded
 * facts.
 * Other words have no reading, because these are the forms taught this way.
 */
export function operandReading(
  facts: WordFacts | undefined,
): OperandReading | undefined {
  if (facts?.branch !== undefined) {
    return branchReading(facts.branch);
  }
  if (facts?.jump !== undefined) {
    return jumpReading(facts.jump, facts.index);
  }
  const memory = facts?.memory;
  if (memory === undefined) {
    return undefined;
  }
  const bytes = `${String(memory.bytes)} ${memory.bytes === 1 ? "byte" : "bytes"}`;
  const offset = hex(memory.offset);
  const place: OperandPart[] = [
    {
      role: "offset",
      value: offset,
      meaning: "Bytes to add to the base address.",
    },
    {
      role: "base",
      value: memory.base,
      meaning: "The register holding the starting address.",
    },
  ];
  if (memory.kind === "load") {
    return {
      parts: [
        {
          role: "destination",
          value: memory.register,
          meaning: "Receives the value read from memory.",
        },
        ...place,
      ],
      summary: `Read ${bytes} from memory at ${memory.base} + ${offset}, and put the value in ${memory.register}.`,
    };
  }
  return {
    parts: [
      {
        role: "source",
        value: memory.register,
        meaning:
          "Holds the value to write. For a store, the first operand is the source.",
      },
      ...place,
    ],
    summary: `${memory.register} → memory: write ${bytes} from ${memory.register} to memory at ${memory.base} + ${offset}.`,
  };
}

/**
 * A branch's operands. The distance is the part worth labeling: the listing
 * prints bytes from the branch's own row, and the player counts rows.
 */
function branchReading(branch: BranchTest): OperandReading {
  const rows = branch.displacement / 4;
  const forward = branch.displacement > 0;
  const distance = rowCount(rows);
  const tested =
    branch.registers.length === 0
      ? "the values it compares"
      : branch.registers.join(" and ");
  return {
    parts: [
      ...branch.registers.map((register, index) => ({
        role:
          branch.registers.length === 1
            ? "tested"
            : `tested ${String(index + 1)}`,
        value: register,
        meaning:
          branch.registers.length === 1
            ? "The register the branch asks about. No separate instruction tests it."
            : "One of the two registers the branch compares, in the order written.",
      })),
      {
        role: "distance",
        value: `${forward ? "+" : "-"}${String(Math.abs(branch.displacement))}`,
        meaning:
          "Bytes from this row, not an address. A row is 4 bytes, so divide by 4 to count rows.",
      },
    ],
    summary: `Read ${tested}; when the branch is taken, continue ${distance} further ${forward ? "down" : "up"}, at word ${String(branch.target)}. The row directly below runs either way.`,
  };
}

/**
 * A jump's destination. The word prints as j 0x0 because the linker has not
 * filled the field in yet, so the row comes from the relocation instead.
 */
function jumpReading(jump: JumpTarget, index: number): OperandReading {
  const rows = jump.target - index;
  return {
    parts: [
      {
        role: "destination",
        value: "0x0",
        meaning:
          "Left zero until the program is linked. A relocation records where it goes, and the comparison checks that instead.",
      },
    ],
    summary: `Always go, with no question asked: continue ${rowCount(rows)} further ${rows > 0 ? "down" : "up"}, at word ${String(jump.target)}. The row directly below runs first.`,
  };
}

function rowCount(rows: number): string {
  const count = Math.abs(rows);
  return `${String(count)} ${count === 1 ? "row" : "rows"}`;
}

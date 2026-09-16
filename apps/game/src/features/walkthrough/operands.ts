import type { WordFacts } from "@osp/matching-core";
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
 * The operands of a load or store, labeled from decoded facts. Other words
 * have no reading, because only memory access has a form taught this way.
 */
export function operandReading(
  facts: WordFacts | undefined,
): OperandReading | undefined {
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

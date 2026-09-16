import { decode, REGISTER_NAMES } from "psyq-asm";
import { LOAD_FORMS, STORE_BYTES } from "./classes.ts";

/** A load from memory or a store to it, read from one instruction's operands. */
export interface MemoryAccess {
  readonly kind: "load" | "store";
  /** The register loaded into, or stored from. */
  readonly register: string;
  readonly base: string;
  readonly offset: number;
  readonly bytes: number;
  /** Loads only: whether the value is sign-extended. */
  readonly signed?: boolean;
}

/** What one target word does with registers and memory. */
export interface WordFacts {
  readonly index: number;
  readonly reads: readonly string[];
  readonly writes: readonly string[];
  readonly memory?: MemoryAccess;
  /**
   * The earlier word that last wrote the memory base register. Absent when
   * the base still holds its value from function entry.
   */
  readonly baseWrittenBy?: number;
}

function registerName(number: number): string {
  const name = REGISTER_NAMES[number] ?? String(number);
  return name.startsWith("$") ? name : `$${name}`;
}

/**
 * Text with numeric register names such as `$3` written as the ABI names
 * listings use, such as `$v1`.
 */
export function abiRegisterNames(text: string): string {
  return text.replace(/\$(\d+)\b/g, (match, digits: string) => {
    const number = Number(digits);
    return number < 32 ? registerName(number) : match;
  });
}

/**
 * Static facts about each word, in order, for teaching diagrams. Words are
 * decoded, never executed: no register or memory value is computed.
 */
export function wordFacts(words: ArrayLike<number>): WordFacts[] {
  const lastWriter = new Map<number, number>();
  return Array.from(words, (word, index): WordFacts => {
    const instruction = decode(word);
    if (instruction.mnemonic === ".word") {
      return { index, reads: [], writes: [] };
    }
    let facts: WordFacts = {
      index,
      reads: instruction.reads.map(registerName),
      writes: instruction.writes.map(registerName),
    };
    const load = LOAD_FORMS.get(instruction.mnemonic);
    const bytes = load?.bytes ?? STORE_BYTES.get(instruction.mnemonic);
    const [value, place] = instruction.operands;
    if (bytes !== undefined && value?.kind === "gpr" && place?.kind === "mem") {
      const writer = lastWriter.get(place.base);
      facts = {
        ...facts,
        memory: {
          kind: load === undefined ? "store" : "load",
          register: registerName(value.number),
          base: registerName(place.base),
          offset: place.offset,
          bytes,
          ...(load === undefined ? {} : { signed: load.signed }),
        },
        ...(writer === undefined ? {} : { baseWrittenBy: writer }),
      };
    }
    for (const register of instruction.writes) {
      lastWriter.set(register, index);
    }
    return facts;
  });
}

/** Whether the function changes the stack pointer, so it has a frame. */
export function usesStack(facts: readonly WordFacts[]): boolean {
  return facts.some((word) => word.writes.includes("$sp"));
}

import { decode, REGISTER_NAMES } from "psyq-asm";
import { LOAD_FORMS, STORE_BYTES } from "./classes.ts";
import type { FunctionRelocation } from "./types.ts";

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

/**
 * A conditional branch, read from one instruction's operands.
 *
 * `displacement` is the field as the listing prints it: a distance in bytes
 * from the branch's own word, so a row is four. `target` is that distance
 * resolved to a word index, which may fall outside the function.
 */
export interface BranchTest {
  /** The registers the branch compares, in operand order. */
  readonly registers: readonly string[];
  readonly displacement: number;
  readonly target: number;
}

/**
 * An unconditional jump, whose destination the word itself does not hold.
 *
 * In an unlinked object a `j` reads `0x0` because the linker fills the field
 * in. The destination comes from the jump's `MIPS26` relocation, whose section
 * offset counts bytes from the start of the section. A synthetic target is the
 * only function in its section, so that offset over four is a word index.
 */
export interface JumpTarget {
  readonly target: number;
}

/**
 * A call, whose callee the word itself does not hold: `jal 0x0` until
 * linking. The callee is the symbol its `MIPS26` relocation names.
 */
export interface CallTarget {
  readonly callee: string;
}

/** What one target word does with registers and memory. */
export interface WordFacts {
  readonly index: number;
  readonly reads: readonly string[];
  readonly writes: readonly string[];
  readonly memory?: MemoryAccess;
  readonly branch?: BranchTest;
  readonly jump?: JumpTarget;
  readonly call?: CallTarget;
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
 * decoded, never executed: no register or memory value is computed. Passing
 * an unlinked target's relocations resolves where each `j` goes and which
 * function each `jal` calls.
 */
export function wordFacts(
  words: ArrayLike<number>,
  relocations: readonly FunctionRelocation[] = [],
): WordFacts[] {
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
    const displacement = instruction.operands.find(
      (operand) => operand.kind === "branch",
    );
    if (displacement !== undefined) {
      facts = {
        ...facts,
        branch: {
          registers: instruction.operands.flatMap((operand) =>
            operand.kind === "gpr" ? [registerName(operand.number)] : [],
          ),
          // The field counts instructions from the delay slot; the listing
          // prints bytes from the branch itself, which is one word earlier.
          displacement: (displacement.displacement + 1) * 4,
          target: index + 1 + displacement.displacement,
        },
      };
    }
    const relocated = relocations.find(
      (relocation) =>
        relocation.offset === index * 4 && relocation.kind === "MIPS26",
    );
    if (instruction.mnemonic === "j" && relocated?.target.kind === "section") {
      facts = { ...facts, jump: { target: relocated.target.offset / 4 } };
    }
    if (instruction.mnemonic === "jal" && relocated?.target.kind === "symbol") {
      facts = { ...facts, call: { callee: relocated.target.name } };
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

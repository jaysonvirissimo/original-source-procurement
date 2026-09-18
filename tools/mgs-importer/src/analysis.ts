import {
  INSTRUCTION_CLASSES,
  LOAD_FORMS,
  STORE_BYTES,
  transfersControl,
  type Decoded,
} from "@osp/matching-core";
import type { DifficultyProfile } from "@osp/mission-schema";
import { decodeWords, type Instruction } from "psyq-asm";

/**
 * What one function's words show, read off the decoded instructions alone.
 *
 * Nothing here executes the function or models the machine: it counts
 * instruction shapes, exactly as the game's own annotations do.
 */
export interface FunctionFacts {
  readonly words: number;
  readonly branches: number;
  readonly jumps: number;
  readonly calls: number;
  readonly basicBlocks: number;
  readonly loops: number;
  readonly loads: number;
  readonly stores: number;
  readonly loadForms: number;
  readonly storeForms: number;
  readonly signedLoads: number;
  /** Loads narrower than a word. */
  readonly narrowLoads: number;
  /** Stores narrower than a word. */
  readonly narrowStores: number;
  /** Narrow loads and narrow stores together. */
  readonly narrowAccesses: number;
  readonly fieldAccesses: number;
  readonly stackAccesses: number;
  /** Loads and stores reached through an argument register. */
  readonly argumentBaseAccesses: number;
  /** Loads and stores reached through the global pointer. */
  readonly gpAccesses: number;
  /** Loads and stores reached through an address built with an upper immediate. */
  readonly absoluteAccesses: number;
  /** Upper immediates, which build an absolute address or a large constant. */
  readonly upperImmediates: number;
  readonly multiplyDivide: number;
  readonly coprocessor: number;
  readonly nops: number;
  readonly filledDelaySlots: number;
  readonly assemblerTemporary: number;
}

const AT = 1;
const SP = 29;
const GP = 28;
const ARGUMENT_REGISTERS = new Set([4, 5, 6, 7]);

function isNop(instruction: Decoded | undefined): boolean {
  return (
    instruction?.mnemonic === "sll" &&
    instruction.operands.every(
      (operand) =>
        (operand.kind === "gpr" && operand.number === 0) ||
        (operand.kind === "shamt" && operand.value === 0),
    )
  );
}

function memoryOperand(
  instruction: Instruction,
): { base: number; offset: number } | undefined {
  for (const operand of instruction.operands) {
    if (operand.kind === "mem") return operand;
  }
  return undefined;
}

/** Counts the instruction shapes a difficulty profile and its tags are built from. */
export function functionFacts(words: readonly number[]): FunctionFacts {
  const program = decodeWords(words);
  const { instructions, branchTargets } = program;

  const blockStarts = new Set<number>([0]);
  const loadForms = new Set<string>();
  const storeForms = new Set<string>();
  let branches = 0;
  let jumps = 0;
  let calls = 0;
  let loops = 0;
  let loads = 0;
  let stores = 0;
  let signedLoads = 0;
  let narrowLoads = 0;
  let narrowStores = 0;
  let fieldAccesses = 0;
  let stackAccesses = 0;
  let argumentBaseAccesses = 0;
  let gpAccesses = 0;
  let absoluteAccesses = 0;
  let upperImmediates = 0;
  let multiplyDivide = 0;
  /*
   * Registers whose latest write was an upper immediate, so a load or store
   * based on one reaches an absolute address rather than a field of something
   * the function was handed. The scan is forward and per-register, with no
   * model of branches, which is enough for the straight-line functions the
   * early field missions draw from.
   */
  const upperImmediateRegisters = new Set<number>();
  let coprocessor = 0;
  let nops = 0;
  let filledDelaySlots = 0;
  let assemblerTemporary = 0;

  instructions.forEach((instruction, index) => {
    if (instruction.mnemonic === ".word") return;

    const family = INSTRUCTION_CLASSES[instruction.mnemonic];
    if (family === "branch") branches += 1;
    if (family === "jump") jumps += 1;
    if (family === "multiply-divide") multiplyDivide += 1;
    if (family === "coprocessor") coprocessor += 1;
    if (instruction.mnemonic === "jal" || instruction.mnemonic === "jalr") {
      calls += 1;
    }

    if (transfersControl(instruction)) {
      blockStarts.add(index + 2);
      const slot = instructions[index + 1];
      if (slot !== undefined && !isNop(slot)) filledDelaySlots += 1;
    }

    const target = branchTargets.get(index);
    if (target !== undefined) {
      blockStarts.add(target);
      if (target <= index) loops += 1;
    }

    if (isNop(instruction)) nops += 1;
    if ([...instruction.reads, ...instruction.writes].includes(AT)) {
      assemblerTemporary += 1;
    }

    const load = LOAD_FORMS.get(instruction.mnemonic);
    const storeBytes = STORE_BYTES.get(instruction.mnemonic);
    if (load !== undefined) {
      loads += 1;
      loadForms.add(instruction.mnemonic);
      if (load.signed && load.bytes < 4) signedLoads += 1;
      if (load.bytes < 4) narrowLoads += 1;
    }
    if (storeBytes !== undefined) {
      stores += 1;
      storeForms.add(instruction.mnemonic);
      if (storeBytes < 4) narrowStores += 1;
    }

    // Where the access points, for the loads and stores a mission compares.
    if (load !== undefined || storeBytes !== undefined) {
      const memory = memoryOperand(instruction);
      if (memory?.base === SP) stackAccesses += 1;
      else if (memory !== undefined && memory.offset !== 0) fieldAccesses += 1;

      // What the access is based on, which decides whether reading it needs a
      // storage skill. Read before the write below, so `lw $v0,n($v0)` after an
      // upper immediate still counts against the register it came from.
      if (memory !== undefined && memory.base !== SP) {
        if (ARGUMENT_REGISTERS.has(memory.base)) argumentBaseAccesses += 1;
        else if (memory.base === GP) gpAccesses += 1;
        else if (upperImmediateRegisters.has(memory.base)) {
          absoluteAccesses += 1;
        }
      }
    }

    if (instruction.mnemonic === "lui") {
      upperImmediates += 1;
      for (const register of instruction.writes) {
        upperImmediateRegisters.add(register);
      }
    } else {
      for (const register of instruction.writes) {
        upperImmediateRegisters.delete(register);
      }
    }
  });

  return {
    words: words.length,
    branches,
    jumps,
    calls,
    basicBlocks: [...blockStarts].filter((start) => start < words.length)
      .length,
    loops,
    loads,
    stores,
    loadForms: loadForms.size,
    storeForms: storeForms.size,
    signedLoads,
    narrowLoads,
    narrowStores,
    narrowAccesses: narrowLoads + narrowStores,
    fieldAccesses,
    stackAccesses,
    argumentBaseAccesses,
    gpAccesses,
    absoluteAccesses,
    upperImmediates,
    multiplyDivide,
    coprocessor,
    nops,
    filledDelaySlots,
    assemblerTemporary,
  };
}

/**
 * A static difficulty profile. The axes are relative scores, not estimates of
 * time: a reviewer ranks candidates by them, and a maintainer decides where a
 * mission belongs. Every axis is a deterministic function of the facts above
 * and of the recorded context, so the same checkout always scores the same.
 */
export function difficultyOf(
  facts: FunctionFacts,
  headerCount: number,
): DifficultyProfile {
  return {
    size: facts.words,
    controlFlow:
      facts.branches + facts.jumps + facts.basicBlocks + facts.loops * 2,
    memory: facts.loads + facts.stores + facts.loadForms + facts.storeForms,
    abi: facts.calls * 2 + facts.stackAccesses,
    types: facts.narrowAccesses + facts.signedLoads + facts.multiplyDivide,
    compilerShaping:
      facts.nops + facts.filledDelaySlots + facts.assemblerTemporary,
    context: headerCount,
    specialHardware: facts.coprocessor,
  };
}

/** Feature tags a reviewer maps to skills when authoring a mission override. */
export const FEATURE_TAGS = [
  "branch",
  "loop",
  "call",
  "stack-frame",
  "load",
  "store",
  "field-offset",
  "narrow-access",
  "signed-load",
  "multiply-divide",
  "delay-slot-filled",
  "assembler-temporary",
  "gte",
] as const;

export type FeatureTag = (typeof FEATURE_TAGS)[number];

/** The tags this function's instructions show, in the order above. */
export function featureTags(facts: FunctionFacts): FeatureTag[] {
  const present: Record<FeatureTag, boolean> = {
    branch: facts.branches > 0,
    loop: facts.loops > 0,
    call: facts.calls > 0,
    "stack-frame": facts.stackAccesses > 0,
    load: facts.loads > 0,
    store: facts.stores > 0,
    "field-offset": facts.fieldAccesses > 0,
    "narrow-access": facts.narrowAccesses > 0,
    "signed-load": facts.signedLoads > 0,
    "multiply-divide": facts.multiplyDivide > 0,
    "delay-slot-filled": facts.filledDelaySlots > 0,
    "assembler-temporary": facts.assemblerTemporary > 0,
    gte: facts.coprocessor > 0,
  };
  return FEATURE_TAGS.filter((tag) => present[tag]);
}

/**
 * Whether a function fits a field mission the course has already prepared a
 * player for: no coprocessor, multiply or divide, and no assembler temporary.
 *
 * The filter follows the curriculum and is widened by the phase that teaches
 * what it was rejecting. Narrow stores and variables the caller never handed
 * over went first, once the memory widths phase taught them; branches, loops,
 * jumps, calls and stack frames followed once the conditions, branches, loops
 * and functions phases did. Those are now columns in the review report for a
 * maintainer to read. What stays rejected is machinery no phase teaches yet.
 */
export function earlyFieldCandidate(facts: FunctionFacts): boolean {
  return (
    facts.coprocessor === 0 &&
    facts.multiplyDivide === 0 &&
    facts.assemblerTemporary === 0
  );
}

/**
 * The address a linked `jal` or `j` word jumps to. The instruction keeps the
 * low 28 bits of the destination, in words; the top four bits come from the
 * address of the row after it, which is where the jump executes from once its
 * delay slot runs.
 */
export function linkedCallAddress(
  word: number,
  functionAddress: number,
  index: number,
): number {
  const next = functionAddress + 4 * (index + 1);
  return ((next & 0xf0000000) | ((word & 0x03ffffff) << 2)) >>> 0;
}

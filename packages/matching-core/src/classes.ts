import type { Instruction, Mnemonic, UnknownInstruction } from "psyq-asm";

export type Decoded = Instruction | UnknownInstruction;

/** Broad instruction families, used to prefer plausible alignments. */
export type InstructionClass =
  | "shift"
  | "jump"
  | "system"
  | "multiply-divide"
  | "register-arithmetic"
  | "branch"
  | "immediate-arithmetic"
  | "load"
  | "store"
  | "coprocessor";

export const INSTRUCTION_CLASSES: Readonly<Record<Mnemonic, InstructionClass>> =
  {
    sll: "shift",
    srl: "shift",
    sra: "shift",
    sllv: "shift",
    srlv: "shift",
    srav: "shift",
    jr: "jump",
    jalr: "jump",
    j: "jump",
    jal: "jump",
    syscall: "system",
    break: "system",
    tge: "system",
    rfe: "system",
    mfhi: "multiply-divide",
    mthi: "multiply-divide",
    mflo: "multiply-divide",
    mtlo: "multiply-divide",
    mult: "multiply-divide",
    multu: "multiply-divide",
    div: "multiply-divide",
    divu: "multiply-divide",
    add: "register-arithmetic",
    addu: "register-arithmetic",
    sub: "register-arithmetic",
    subu: "register-arithmetic",
    and: "register-arithmetic",
    or: "register-arithmetic",
    xor: "register-arithmetic",
    nor: "register-arithmetic",
    slt: "register-arithmetic",
    sltu: "register-arithmetic",
    bltz: "branch",
    bgez: "branch",
    bltzal: "branch",
    bgezal: "branch",
    beq: "branch",
    bne: "branch",
    blez: "branch",
    bgtz: "branch",
    addi: "immediate-arithmetic",
    addiu: "immediate-arithmetic",
    slti: "immediate-arithmetic",
    sltiu: "immediate-arithmetic",
    andi: "immediate-arithmetic",
    ori: "immediate-arithmetic",
    xori: "immediate-arithmetic",
    lui: "immediate-arithmetic",
    lb: "load",
    lh: "load",
    lwl: "load",
    lw: "load",
    lbu: "load",
    lhu: "load",
    lwr: "load",
    sb: "store",
    sh: "store",
    swl: "store",
    sw: "store",
    swr: "store",
    lwc2: "coprocessor",
    swc2: "coprocessor",
    mfc0: "coprocessor",
    mtc0: "coprocessor",
    mfc2: "coprocessor",
    cfc2: "coprocessor",
    mtc2: "coprocessor",
    ctc2: "coprocessor",
    cop2: "coprocessor",
  };

export interface LoadForm {
  readonly bytes: number;
  readonly signed: boolean;
}

/** Loads that differ only in width or signedness. */
export const LOAD_FORMS: ReadonlyMap<Mnemonic, LoadForm> = new Map([
  ["lb", { bytes: 1, signed: true }],
  ["lbu", { bytes: 1, signed: false }],
  ["lh", { bytes: 2, signed: true }],
  ["lhu", { bytes: 2, signed: false }],
  ["lw", { bytes: 4, signed: true }],
]);

/** Stores that differ only in width. */
export const STORE_BYTES: ReadonlyMap<Mnemonic, number> = new Map([
  ["sb", 1],
  ["sh", 2],
  ["sw", 4],
]);

/** Whether the instruction has a delay slot after it. */
export function transfersControl(instruction: Decoded): boolean {
  return (
    instruction.mnemonic !== ".word" &&
    (instruction.hazardClass === "branch" || instruction.hazardClass === "jump")
  );
}

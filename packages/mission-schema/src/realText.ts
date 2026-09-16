/**
 * Real missions compare against machine code from the game. Their briefings
 * and hints are original teaching text, so they point players at the target
 * rows the game displays and never quote those rows: no register names, no
 * instruction mnemonics, and no hexadecimal values.
 */

const REGISTER =
  /\$(?:zero|at|v[01]|a[0-3]|t[0-9]|s[0-8]|k[01]|gp|sp|fp|ra|[12]?[0-9]|3[01])\b/i;

const HEX = /\b0x[0-9a-f]+\b/i;

// Mnemonics that are not also ordinary English words, so prose such as "or",
// "and", "add", "sub", "move", "j", and "b" stays allowed. Matching is
// case-sensitive, as listings print mnemonics in lowercase.
const MNEMONICS = [
  "addi",
  "addiu",
  "addu",
  "andi",
  "beq",
  "beqz",
  "bgez",
  "bgtz",
  "blez",
  "bltz",
  "bne",
  "bnez",
  "div",
  "divu",
  "jal",
  "jalr",
  "jr",
  "lb",
  "lbu",
  "lh",
  "lhu",
  "lui",
  "lw",
  "mfhi",
  "mflo",
  "mult",
  "multu",
  "negu",
  "nop",
  "nor",
  "ori",
  "sb",
  "sh",
  "sll",
  "sllv",
  "slt",
  "slti",
  "sltiu",
  "sltu",
  "sra",
  "srav",
  "srl",
  "srlv",
  "subu",
  "sw",
  "xor",
  "xori",
] as const;

const MNEMONIC = new RegExp(`(?<![\\w$])(?:${MNEMONICS.join("|")})(?![\\w$])`);

/**
 * Why a real mission's text quotes target instructions, one message per kind
 * of quotation found, or an empty list when it quotes none.
 */
export function realMissionTextIssues(text: string): string[] {
  const issues: string[] = [];
  const register = REGISTER.exec(text);
  if (register !== null) {
    issues.push(`names the register ${register[0]}`);
  }
  const hex = HEX.exec(text);
  if (hex !== null) {
    issues.push(`quotes the value ${hex[0]}`);
  }
  const mnemonic = MNEMONIC.exec(text);
  if (mnemonic !== null) {
    issues.push(`names the instruction ${mnemonic[0]}`);
  }
  return issues;
}

import type { ManualEntry } from "@osp/mission-schema";

/** Manual entries that skills and first-slice annotations link to. */
export const manualEntries: readonly ManualEntry[] = [
  {
    id: "c.integer-types",
    section: "C",
    title: "Integer types",
    body: [
      "int is 32 bits. short is 16 bits. char is 8 bits.",
      "signed char holds -128 to 127. unsigned char holds 0 to 255.",
      "Plain char is unsigned in PsyQ. A field declared as char behaves like unsigned char, not signed char.",
    ],
  },
  {
    id: "c.pointers",
    section: "C",
    title: "Pointers",
    body: [
      "A pointer holds an address. int *p means p holds the address of an int.",
      "*p reads the int at that address. *p = v writes v there.",
      "A pointer argument arrives in an argument register like any other value. The load or store uses that register as its base.",
    ],
  },
  {
    id: "c.structs",
    section: "C",
    title: "Structs",
    body: [
      "A struct places its fields one after another in memory. Each field sits at a fixed offset from the start of the struct.",
      "In struct Obj { int a; int b; int c; }, a is at offset 0, b at 4, and c at 8, because each int takes 4 bytes.",
      "A char field takes 1 byte. After int id, a char delta sits at offset 4 and the next char at offset 5.",
      "o->c reads the field c of the struct that o points to: memory at o plus the offset of c.",
    ],
  },
  {
    id: "mips.arithmetic",
    section: "MIPS",
    title: "Arithmetic",
    body: [
      "addiu $v0,$a0,imm stores $a0 plus a 16-bit constant in $v0. The constant is sign-extended, so it can be negative.",
      "sll $v0,$a0,n stores $a0 shifted left by n bits in $v0. Shifting left by n multiplies by 2 to the power n.",
      "The listing shows immediates in hexadecimal: 0x5 is 5 and 0x2A is 42. Shift amounts are decimal.",
      "When one expression needs two steps, the compiler keeps the intermediate value in a register, often the destination register itself.",
    ],
  },
  {
    id: "mips.loads-and-stores",
    section: "MIPS",
    title: "Loads and stores",
    body: [
      "Memory is reached through a base register plus an offset. lw $v0,0x8($a0) reads 32 bits from the address in $a0 plus 8.",
      "sw $a1,0x0($a0) writes the 32 bits in $a1 to the address in $a0.",
      "lb and lbu read 8 bits. lb sign-extends the byte to 32 bits; lbu zero-extends it.",
      "A signed char loads with lb. An unsigned char or a plain char loads with lbu.",
      "The offset shows which field is read; the instruction shows its width and signedness.",
    ],
  },
  {
    id: "mips.delay-slots",
    section: "MIPS",
    title: "Delay slots",
    body: [
      "The instruction right after a jump or branch is its delay slot. It runs before control reaches the new address.",
      "jr $ra returns to the caller. The instruction after it still runs first, so the compiler often places the last step of a function there.",
      "When nothing useful can run in the delay slot, the assembler fills it with a nop.",
    ],
  },
  {
    id: "mips.assembler-nops",
    section: "MIPS",
    title: "Assembler-inserted nops",
    body: [
      "Some nops are not in the compiler's output. The assembler inserts them.",
      "A branch delay nop fills a delay slot that has nothing else to run.",
      "A load delay nop follows a load when the next instruction reads the register just loaded. The loaded value is not ready one instruction later.",
      "These nops are part of the target. Matching C produces them too.",
    ],
  },
  {
    id: "abi.arguments",
    section: "ABI",
    title: "Arguments",
    body: [
      "The first four integer or pointer arguments arrive in $a0, $a1, $a2, and $a3, in order.",
      "In int f(int a, int b), a is in $a0 and b is in $a1 when the function starts.",
    ],
  },
  {
    id: "abi.return-values",
    section: "ABI",
    title: "Return values",
    body: [
      "A function returns an int or a pointer in $v0.",
      "jr $ra jumps back to the caller, whose return address is in $ra.",
      "A void function sets no return value.",
    ],
  },
  {
    id: "matching.signedness",
    section: "MATCHING",
    title: "Signedness",
    body: [
      "Two C programs can do the same useful work and still assemble differently. Matching needs the same words.",
      "A byte field declared with the wrong signedness loads with the wrong instruction: lbu instead of lb, or the reverse.",
      "Fix it where the type is declared. If the target uses lb, the field is signed char. If it uses lbu, it is unsigned char or plain char.",
    ],
  },
];

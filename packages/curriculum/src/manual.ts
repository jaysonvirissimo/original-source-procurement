import type { ManualEntry } from "@osp/mission-schema";

/**
 * Manual entries. Skills, annotations, and mission terms link to them, and
 * ORIENTATION entries are read in the order listed here.
 */
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
  {
    id: "mips.instruction-reading",
    section: "MIPS",
    title: "Instruction reading",
    body: [
      "Each listing line is one instruction: a mnemonic, then operands separated by commas. The mnemonic names the operation.",
      "Arithmetic writes to its first operand. addiu $v0,$a0,0x5 reads $a0, adds 5, and writes the sum to $v0. move $v0,$a0 copies $a0 into $v0.",
      "A load also writes to its first operand. lw $v0,0x8($a0) reads memory at the address in $a0 plus 8 and writes the value to $v0.",
      "A store reads from its first operand. sw $a1,0x0($a0) and sb $a1,0x0($a0) write the value in $a1 to memory at the address in $a0. No register changes.",
      "A jump names where to go. jr $ra jumps to the address held in $ra.",
    ],
  },
  {
    id: "orientation.activity",
    section: "ORIENTATION",
    title: "What you are doing",
    body: [
      "A game ships as machine code: the numbers a processor runs. The C source it was built from is gone.",
      "Matching decompilation writes new C that the original compiler turns into exactly the same machine code. Each mission shows a target function's instructions. You write C until your compiled instructions are identical.",
      "Exact output matters because the mgs_reversing project rebuilds the whole game from recovered C and checks that the result is byte-for-byte the original. Code that only behaves the same does not pass that check.",
    ],
  },
  {
    id: "orientation.success",
    section: "ORIENTATION",
    title: "What an exact match proves",
    body: [
      "An exact match proves that your C compiles to the same instructions as the target. It does not prove that your C is the text the original programmers wrote.",
      "Different C can compile to the same instructions. In mission 004, return a << 3; and return a * 8; both match, because the compiler turns multiplying by 8 into a shift by 3.",
      "Any matching source is a correct answer. When a match needs a particular spelling, the mission teaches why.",
    ],
  },
  {
    id: "orientation.machine",
    section: "ORIENTATION",
    title: "The machine and its rules",
    body: [
      "The game is Metal Gear Solid for the original Sony PlayStation (PS1). Its processor runs the MIPS instruction set: a small list of simple operations on numbers.",
      "The calling convention, or ABI, is the agreement about where a function finds its arguments and leaves its return value. On this machine they travel in specific registers.",
      "PsyQ is the C compiler the game was built with, and ASPSX is its assembler. Each has habits of its own. For example, plain char is unsigned in PsyQ.",
      "Keep two kinds of rule apart. C rules hold for C everywhere. Target rules belong to MIPS, this ABI, PsyQ, or ASPSX. Missions say which kind a rule is.",
    ],
  },
  {
    id: "orientation.compile",
    section: "ORIENTATION",
    title: "What Compile does",
    body: [
      "Compile sends your C to the PsyQ compiler, which writes assembly. The ASPSX assembler turns the assembly into words: 32-bit numbers, one per instruction. OSP compares your words with the target's.",
      "Nothing runs. There is no program output and no test suite. The only question is whether the instructions are the same.",
      "Register and memory diagrams show made-up example values that explain what the instructions would do. They are not the result of running your source.",
    ],
  },
  {
    id: "orientation.c-functions",
    section: "ORIENTATION",
    title: "C functions for JavaScript developers",
    body: [
      "int add_five(int a) { return a + 5; } is like function addFive(a) { return a + 5; } in JavaScript, with types written in.",
      "Read it left to right. int is the return type: the function gives back an integer. add_five is the name. (int a) is the parameter list: one integer parameter named a. The braces hold the body, and return gives back a value.",
      "int return_path(void) has void in its parameter list. There, void means the function takes no parameters.",
      "void store(int *p) has void before its name. There, void means the function returns nothing. Later missions use both meanings.",
    ],
  },
  {
    id: "orientation.registers",
    section: "ORIENTATION",
    title: "Registers",
    body: [
      "A register is a named storage slot inside the processor. Each holds one 32-bit number. Instructions read and write registers because they are much faster to reach than memory.",
      "Register names start with $. $v0 carries a function's return value, $a0 through $a3 carry its first arguments, $ra holds the address to return to, and $zero always reads as 0.",
      "Registers are not C variables, and they are not memory. You never declare $v0 in C. The compiler decides which registers hold your values, following the ABI.",
    ],
  },
  {
    id: "orientation.reading-instructions",
    section: "ORIENTATION",
    title: "Reading an instruction",
    body: [
      "A listing line has a mnemonic, the operation's short name, then operands. For arithmetic, the first operand is the destination: the register that receives the result.",
      "Read addiu $v0,$zero,0x2A aloud as: add the constant 0x2A to $zero, which is 0, and put the result in $v0. It sets $v0 to 42.",
      "Read jr $ra as: jump to the address in $ra. That is how a function returns to its caller.",
      "The Instruction reading entry in the MIPS section lists the operand order for each family of instructions.",
    ],
  },
  {
    id: "orientation.hexadecimal",
    section: "ORIENTATION",
    title: "Hexadecimal",
    body: [
      "Listings write constants in hexadecimal, base 16. The prefix 0x marks a hexadecimal number. Digits run 0 to 9, then A to F for 10 to 15.",
      "0x2A is 2 sixteens plus 10 ones: 32 + 10 = 42.",
      "The Word column in the target listing numbers the instructions from 0, in order. Those numbers are positions, not values the function computes.",
    ],
  },
  {
    id: "orientation.prerequisites",
    section: "ORIENTATION",
    title: "What you need",
    body: [
      "You need to be comfortable reading and editing code in some language, such as JavaScript. You do not need to know C, assembly, or binary arithmetic.",
      "This orientation covers the C and machine vocabulary the first missions use. Each mission lists its terms, and every term has a GLOSSARY entry in the manual.",
      "The manual is always available. Search it from any mission, or browse all entries.",
    ],
  },
  {
    id: "tools.overview",
    section: "TOOLS",
    title: "Workspace tools",
    body: [
      "Manual is the concept reference: what an instruction, type, or rule means. Search it for any term. Try it first.",
      "Scan explains the target listing itself: notes on its instructions and example values for registers and memory.",
      "Hint gives progressive help for the current mission, one stage at a time. Opening hints is recorded, and the last stage reveals the solution, which completes without advancing your skills.",
      "History lists your earlier compiles for this mission, so you can return to an attempt that got closer.",
    ],
  },
  {
    id: "glossary.register",
    section: "GLOSSARY",
    title: "register",
    body: [
      "A named 32-bit storage slot inside the processor, such as $v0 or $a0. Not a C variable and not memory.",
    ],
  },
  {
    id: "glossary.v0",
    section: "GLOSSARY",
    title: "$v0",
    body: [
      "The register that carries a function's int or pointer return value. The compiler may also use it for intermediate values.",
    ],
  },
  {
    id: "glossary.ra",
    section: "GLOSSARY",
    title: "$ra",
    body: [
      "The return address register. It holds the address in the caller where execution continues after the function returns.",
    ],
  },
  {
    id: "glossary.zero",
    section: "GLOSSARY",
    title: "$zero",
    body: ["A register that always reads as 0. Writes to it are ignored."],
  },
  {
    id: "glossary.jr",
    section: "GLOSSARY",
    title: "jr",
    body: [
      "Jump register. jr $ra jumps to the address in $ra, which returns from the function. Its delay slot runs first.",
    ],
  },
  {
    id: "glossary.addiu",
    section: "GLOSSARY",
    title: "addiu",
    body: [
      "Add immediate. addiu $v0,$a0,0x5 writes $a0 plus 5 to $v0. The constant is 16 bits and sign-extended. The u means an overflow does not stop the program; it does not mean the constant is unsigned.",
    ],
  },
  {
    id: "glossary.instruction",
    section: "GLOSSARY",
    title: "instruction",
    body: [
      "One operation the processor performs, such as an add, a load, or a jump. Each is encoded as one 32-bit word.",
    ],
  },
  {
    id: "glossary.mnemonic",
    section: "GLOSSARY",
    title: "mnemonic",
    body: [
      "The short name of an instruction in a listing, such as addiu, lw, or jr.",
    ],
  },
  {
    id: "glossary.operand",
    section: "GLOSSARY",
    title: "operand",
    body: [
      "A register, constant, or memory location an instruction works on, written after the mnemonic. For arithmetic and loads, the first operand is the destination.",
    ],
  },
  {
    id: "glossary.immediate",
    section: "GLOSSARY",
    title: "immediate",
    body: [
      "A constant stored inside the instruction itself, such as the 0x5 in addiu $v0,$a0,0x5.",
    ],
  },
  {
    id: "glossary.hexadecimal",
    section: "GLOSSARY",
    title: "hexadecimal (0x)",
    body: [
      "Base 16, marked by the prefix 0x. Digits A to F stand for 10 to 15, so 0x2A is 2 × 16 + 10 = 42.",
    ],
  },
  {
    id: "glossary.word",
    section: "GLOSSARY",
    title: "word",
    body: [
      "A 32-bit value. Each instruction is one word, and an int is one word. The Word column in a listing numbers instructions from 0.",
    ],
  },
  {
    id: "glossary.byte",
    section: "GLOSSARY",
    title: "byte",
    body: ["8 bits. A word is 4 bytes. A char is 1 byte."],
  },
  {
    id: "glossary.address",
    section: "GLOSSARY",
    title: "address",
    body: [
      "A number that says where a value is in memory. A pointer holds an address.",
    ],
  },
  {
    id: "glossary.offset",
    section: "GLOSSARY",
    title: "offset",
    body: [
      "A distance in bytes from a base address. In lw $v0,0x8($a0), the offset is 8.",
    ],
  },
  {
    id: "glossary.delay-slot",
    section: "GLOSSARY",
    title: "delay slot",
    body: [
      "The instruction right after a jump or branch. It runs before the jump takes effect.",
    ],
  },
  {
    id: "glossary.nop",
    section: "GLOSSARY",
    title: "nop",
    body: [
      "No operation: an instruction that does nothing. The assembler inserts nops where the machine needs a gap.",
    ],
  },
  {
    id: "glossary.compiler",
    section: "GLOSSARY",
    title: "compiler",
    body: [
      "The program that translates C into assembly. OSP uses PsyQ, the compiler the game was built with.",
    ],
  },
  {
    id: "glossary.assembler",
    section: "GLOSSARY",
    title: "assembler",
    body: [
      "The program that turns assembly into words. OSP uses ASPSX, which also inserts some nops.",
    ],
  },
  {
    id: "glossary.sign-extension",
    section: "GLOSSARY",
    title: "sign extension",
    body: [
      "Widening a value by copying its top bit into the new bits, so a negative number stays negative. Zero extension fills the new bits with 0 instead.",
    ],
  },
  {
    id: "glossary.stack-frame",
    section: "GLOSSARY",
    title: "stack frame",
    body: [
      "Memory a function reserves while it runs, for values that do not fit in registers. The first missions do not use one.",
    ],
  },
];

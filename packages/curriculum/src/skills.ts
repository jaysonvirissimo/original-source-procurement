import type { Skill } from "@osp/mission-schema";

/** Skills taught by the first teaching slice, with their prerequisite edges. */
export const skills: readonly Skill[] = [
  {
    id: "ABI.RETURN",
    name: "Return values",
    description: "An integer result leaves a function in $v0.",
    prerequisites: [],
    manualEntry: "abi.return-values",
  },
  {
    id: "ABI.ARGUMENT",
    name: "Arguments",
    description: "The first four integer arguments arrive in $a0 through $a3.",
    prerequisites: ["ABI.RETURN"],
    manualEntry: "abi.arguments",
  },
  {
    id: "MIPS.ARITH.ADD_IMMEDIATE",
    name: "Add immediate",
    description: "addiu adds a 16-bit signed constant to a register.",
    prerequisites: ["ABI.ARGUMENT"],
    manualEntry: "mips.arithmetic",
  },
  {
    id: "MIPS.ARITH.SHIFT",
    name: "Shifts",
    description: "sll moves a register's bits left by a constant amount.",
    prerequisites: ["ABI.ARGUMENT"],
    manualEntry: "mips.arithmetic",
  },
  {
    id: "MIPS.LOAD.WORD",
    name: "Load word",
    description: "lw reads 32 bits from a base register plus an offset.",
    prerequisites: ["ABI.ARGUMENT"],
    manualEntry: "mips.loads-and-stores",
  },
  {
    id: "C.POINTER.DEREFERENCE",
    name: "Pointer dereference",
    description: "*p reads or writes the value that a pointer addresses.",
    prerequisites: ["MIPS.LOAD.WORD"],
    manualEntry: "c.pointers",
  },
  {
    id: "MIPS.STORE.WORD",
    name: "Store word",
    description: "sw writes 32 bits to a base register plus an offset.",
    prerequisites: ["C.POINTER.DEREFERENCE"],
    manualEntry: "mips.loads-and-stores",
  },
  {
    id: "C.STRUCT.FIELD",
    name: "Struct fields",
    description:
      "p->field addresses memory at the field's offset from the start of the struct.",
    prerequisites: ["C.POINTER.DEREFERENCE"],
    manualEntry: "c.structs",
  },
  {
    id: "MIPS.LOAD.BYTE",
    name: "Load byte",
    description:
      "lb sign-extends an 8-bit load and lbu zero-extends it. Plain char is unsigned in PsyQ.",
    prerequisites: ["C.STRUCT.FIELD"],
    manualEntry: "mips.loads-and-stores",
  },
  {
    id: "MATCH.SIGNEDNESS",
    name: "Signedness",
    description:
      "Plausible C can pick the wrong signedness; the load instruction shows which one the target used.",
    prerequisites: ["MIPS.LOAD.BYTE"],
    manualEntry: "matching.signedness",
  },
  {
    id: "C.ARRAY",
    name: "Arrays",
    description:
      "An array places its elements back to back; element i sits i element sizes from the start.",
    prerequisites: ["C.STRUCT.FIELD"],
    manualEntry: "c.arrays",
  },
  {
    id: "C.STRUCT.NESTED",
    name: "Pointers in structs",
    description:
      "A pointer field holds another struct's address; a->b->c follows it, while an embedded struct sits inside.",
    prerequisites: ["C.STRUCT.FIELD"],
    manualEntry: "c.nested-structs",
  },
  {
    id: "C.INTEGER.WIDTH",
    name: "Integer widths",
    description:
      "char, short, and int take 1, 2, and 4 bytes on this target, and load with lb, lh, and lw.",
    prerequisites: ["MIPS.LOAD.BYTE"],
    manualEntry: "c.integer-widths",
  },
  {
    id: "C.STRUCT.LAYOUT",
    name: "Struct layout",
    description:
      "Alignment adds padding before a field, and an embedded struct takes its whole size.",
    prerequisites: ["C.INTEGER.WIDTH", "C.STRUCT.NESTED", "C.ARRAY"],
    manualEntry: "c.struct-layout",
  },
  {
    id: "C.POINTER.ARITHMETIC",
    name: "Pointer arithmetic",
    description:
      "p + n moves n elements, so the compiler scales n by the size of what p points to.",
    prerequisites: ["C.ARRAY", "C.INTEGER.WIDTH"],
    manualEntry: "c.pointer-arithmetic",
  },
  {
    id: "C.TYPEDEF",
    name: "Type names",
    description:
      "typedef names a type, #include brings in a header's declarations, and void * holds any address.",
    prerequisites: ["C.STRUCT.FIELD"],
    manualEntry: "c.typedef",
  },
  {
    id: "MIPS.ARITH.ADD",
    name: "Register addition",
    description:
      "addu adds two registers. Subtracting a constant is not a subtract at all: it is addiu with the constant negated.",
    prerequisites: ["MIPS.ARITH.ADD_IMMEDIATE"],
    manualEntry: "mips.arithmetic",
  },
  {
    id: "MIPS.ARITH.SUBTRACT",
    name: "Subtraction",
    description:
      "subu subtracts one register from another, and there is no subtract-immediate.",
    prerequisites: ["MIPS.ARITH.ADD"],
    manualEntry: "mips.arithmetic",
  },
  {
    id: "MIPS.REGISTER.TEMP",
    name: "Borrowed registers",
    description:
      "An intermediate value lives in whatever register is free, including an argument register.",
    prerequisites: ["MIPS.ARITH.ADD"],
    manualEntry: "matching.register-reuse",
  },
  {
    id: "C.BITMASK",
    name: "Bit masks",
    description:
      "& keeps chosen bits of a value, and a constant mask that fits 16 bits compiles to one instruction.",
    prerequisites: ["MIPS.ARITH.SHIFT"],
    manualEntry: "c.bit-operations",
  },
  {
    id: "MIPS.LOAD.HALF",
    name: "Load halfword",
    description: "lh sign-extends a 16-bit load and lhu zero-extends it.",
    prerequisites: ["C.INTEGER.WIDTH"],
    manualEntry: "mips.loads-and-stores",
  },
  {
    id: "MIPS.LOAD.SIGNEDNESS",
    name: "Load signedness",
    description:
      "A field's declared signedness picks the load at every width, not just at a byte.",
    prerequisites: ["MIPS.LOAD.HALF"],
    manualEntry: "matching.signedness",
  },
  {
    id: "MIPS.STORE.NARROW",
    name: "Narrow stores",
    description:
      "sb and sh write 1 and 2 bytes, and a store has no signedness of its own.",
    prerequisites: ["MIPS.STORE.WORD", "MIPS.LOAD.HALF"],
    manualEntry: "mips.loads-and-stores",
  },
  {
    id: "C.SHIFT",
    name: "Right shifts",
    description:
      "An unsigned value shifts right with srl and a signed one with sra, which keeps its sign.",
    prerequisites: ["MIPS.ARITH.SHIFT"],
    manualEntry: "mips.arithmetic",
  },
  {
    id: "C.STORAGE.STATIC",
    name: "Static storage",
    description:
      "A variable declared outside a function sits at a fixed address the function builds for itself.",
    prerequisites: ["MIPS.LOAD.WORD"],
    manualEntry: "c.static-storage",
  },
  {
    id: "MIPS.DELAY_SLOT",
    name: "Delay slots",
    description:
      "The instruction after a jump runs before the jump takes effect, so the compiler puts the last step of a function there.",
    prerequisites: ["ABI.RETURN"],
    manualEntry: "mips.delay-slots",
  },
  {
    id: "MIPS.COMPARE",
    name: "Set on less than",
    description:
      "slt and slti write 1 or 0 into a register, so a test in C produces a value like any other.",
    prerequisites: ["MIPS.ARITH.ADD"],
    manualEntry: "mips.comparison",
  },
  {
    id: "MIPS.COMPARE.SIGNEDNESS",
    name: "Test signedness",
    description:
      "The operands' declared signedness picks sltu over slt, the same rule that picks a load.",
    prerequisites: ["MIPS.COMPARE", "MIPS.LOAD.SIGNEDNESS"],
    manualEntry: "matching.signedness",
  },
  {
    id: "MATCH.EXPRESSION_ORDER",
    name: "Expression order",
    description:
      "There is no greater-than instruction, so a > b is written with its operands the other way round.",
    prerequisites: ["MIPS.COMPARE"],
    manualEntry: "matching.expression-shape",
  },
  {
    id: "MATCH.SEMANTIC_VS_EXACT",
    name: "Same meaning, different shape",
    description:
      "A test need not compile to a test: against zero the compiler reaches for the sign bit instead.",
    prerequisites: ["MATCH.EXPRESSION_ORDER"],
    manualEntry: "matching.expression-shape",
  },
  {
    id: "MIPS.BRANCH",
    name: "Branches",
    description:
      "A branch reads a value and skips forward when it holds, so one listing holds two paths.",
    prerequisites: ["MIPS.COMPARE"],
    manualEntry: "mips.branches",
  },
  {
    id: "MIPS.BRANCH.ZERO",
    name: "Branch against zero",
    description:
      "Against zero there is no test instruction: bltz, blez, bgtz and bgez read the value themselves.",
    prerequisites: ["MIPS.BRANCH"],
    manualEntry: "mips.branches",
  },
  {
    id: "MATCH.SCHEDULING",
    name: "Filling a delay slot",
    description:
      "The row after a branch belongs to neither path. It runs either way, and the compiler chooses it.",
    prerequisites: ["MIPS.DELAY_SLOT", "MIPS.BRANCH"],
    manualEntry: "mips.delay-slots",
  },
  {
    id: "MATCH.BRANCH_SENSE",
    name: "Which way the test reads",
    description:
      "Testing the opposite condition and swapping the paths is the same program and a different listing.",
    prerequisites: ["MATCH.SCHEDULING"],
    manualEntry: "matching.branch-sense",
  },
  {
    id: "MIPS.BRANCH.BACKWARD",
    name: "Branching backward",
    description:
      "A branch with a negative distance lands on a row that has already run, so the rows between repeat: a loop.",
    prerequisites: ["MIPS.BRANCH.ZERO"],
    manualEntry: "mips.loops",
  },
  {
    id: "C.LOOP",
    name: "Loops and their guard",
    description:
      "A while or for loop compiles as a do/while with one extra branch in front, which skips the loop when it would not run at all.",
    prerequisites: ["MIPS.BRANCH.BACKWARD"],
    manualEntry: "mips.loops",
  },
  {
    id: "MATCH.LOOP_UNDO",
    name: "Work taken back",
    description:
      "The back edge's delay slot runs on the way out too, so work the compiler put there is taken back out after the loop.",
    prerequisites: ["C.LOOP", "MATCH.SCHEDULING"],
    manualEntry: "matching.loop-shape",
  },
  {
    id: "MATCH.LOOP_INDEX",
    name: "An index becomes a pointer",
    description:
      "An array indexed by a counter compiles to a pointer stepped by the element size. The listing has no multiply.",
    prerequisites: ["C.LOOP", "C.POINTER.ARITHMETIC"],
    manualEntry: "matching.loop-shape",
  },
  {
    id: "MIPS.JUMP",
    name: "Jumps",
    description:
      "j always goes. It is how the first arm of an if/else skips the second, and the linker fills in where it lands.",
    prerequisites: ["MIPS.BRANCH", "MIPS.DELAY_SLOT"],
    manualEntry: "mips.jumps",
  },
  {
    id: "ABI.CALL",
    name: "Calls",
    description:
      "jal goes to another function and leaves the way back in $ra; the arguments go in $a0 to $a3 and the answer comes back in $v0.",
    prerequisites: ["ABI.ARGUMENT", "ABI.RETURN", "MIPS.JUMP"],
    manualEntry: "abi.calls",
  },
  {
    id: "ABI.FRAME",
    name: "Stack frames",
    description:
      "A function that calls another moves $sp down to make room, keeps $ra there, and moves $sp back before it returns.",
    prerequisites: ["ABI.CALL", "MIPS.STORE.WORD"],
    manualEntry: "abi.stack-frames",
  },
  {
    id: "ABI.STACK",
    name: "Arguments on the stack",
    description:
      "A fifth argument has no register. It goes into the caller's frame, 16 bytes up from $sp.",
    prerequisites: ["ABI.FRAME"],
    manualEntry: "abi.arguments",
  },
  {
    id: "MIPS.REGISTER.SAVED",
    name: "Values that survive a call",
    description:
      "A value needed after a call is kept in $s0 to $s7, because a called function may overwrite every other register.",
    prerequisites: ["ABI.FRAME", "MIPS.REGISTER.TEMP"],
    manualEntry: "abi.saved-registers",
  },
  {
    id: "ABI.SAVED_REGISTER",
    name: "Putting them back",
    description:
      "A function that uses an $s register saves the caller's value first and restores it before returning, in the reverse order.",
    prerequisites: ["MIPS.REGISTER.SAVED"],
    manualEntry: "abi.saved-registers",
  },
  {
    id: "MIPS.REGISTER.SCRATCH",
    name: "Scratch registers",
    description:
      "$t0 to $t9 hold intermediates when the argument and result registers are all still needed. Nothing saves them, and a call may destroy them.",
    prerequisites: ["MIPS.REGISTER.SAVED", "MIPS.REGISTER.TEMP"],
    manualEntry: "abi.saved-registers",
  },
];

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
];

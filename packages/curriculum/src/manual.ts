import type { ManualEntry } from "@osp/mission-schema";

/** Manual entries that skills and first-slice annotations link to. */
export const manualEntries: readonly ManualEntry[] = [
  { id: "c.integer-types", section: "C", title: "Integer types" },
  { id: "c.pointers", section: "C", title: "Pointers" },
  { id: "c.structs", section: "C", title: "Structs" },
  { id: "mips.arithmetic", section: "MIPS", title: "Arithmetic" },
  { id: "mips.loads-and-stores", section: "MIPS", title: "Loads and stores" },
  { id: "mips.delay-slots", section: "MIPS", title: "Delay slots" },
  {
    id: "mips.assembler-nops",
    section: "MIPS",
    title: "Assembler-inserted nops",
  },
  { id: "abi.arguments", section: "ABI", title: "Arguments" },
  { id: "abi.return-values", section: "ABI", title: "Return values" },
  { id: "matching.signedness", section: "MATCHING", title: "Signedness" },
];

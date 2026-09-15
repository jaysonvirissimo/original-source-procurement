import type { AssembledObject } from "psyq-asm";
import { describe, expect, expectTypeOf, it } from "vitest";
import { functionFromWords } from "./extract.ts";
import {
  assembleObject,
  functionSource,
  generatedFrom,
  linkedTarget,
  unlinkedTarget,
  wordsOf,
} from "./fixtures.test-helpers.ts";
import { compareFunction, matchFunction } from "./match.ts";
import type {
  GeneratedFunction,
  MatchOutcome,
  MatchTarget,
  Mismatch,
} from "./types.ts";

const RETURN = ["j $31"];

function compare(target: MatchTarget, generated: readonly string[]) {
  return compareFunction(generatedFrom(generated), target);
}

function kinds(mismatches: readonly Mismatch[]) {
  return mismatches.map((mismatch) => mismatch.kind);
}

describe("exact matches", () => {
  it("reports a known pair as exact with zero mismatches", () => {
    const lines = ["addiu $2,$4,5", ...RETURN];
    const result = compare(linkedTarget(lines), lines);

    expect(result.exact).toBe(true);
    expect(result.mismatches).toEqual([]);
    expect(result.score).toBe(1);
    expect(result.alignment.every((row) => row.status === "equal")).toBe(true);
    expect(result.summary).toEqual({
      exact: true,
      equalWords: 3,
      targetWords: 3,
      generatedWords: 3,
      byKind: {},
    });
    expect(result.target.map((instruction) => instruction.text)).toEqual([
      "addiu $v0,$a0,0x5",
      "jr $ra",
      "nop",
    ]);
    expect(result.generated[2]).toEqual({
      index: 2,
      word: 0,
      text: "nop",
      origin: {
        line: 6,
        kind: "branch-delay-nop",
        note: "the delay slot of jr under .set reorder",
      },
      fieldMask: 0,
    });
  });

  it("matches linked HI16/LO16 addresses and reports their field differences", () => {
    const lines = ["la $2,g", ...RETURN];
    const words = wordsOf(lines);
    const linked = [
      (words[0] ?? 0) | 0x8001,
      (words[1] ?? 0) | 0x2000,
      ...words.slice(2),
    ];
    const result = compare({ kind: "linked", words: linked }, lines);

    expect(result.exact).toBe(true);
    expect(result.mismatches).toEqual([]);
    expect(result.alignment.map((row) => row.status)).toEqual([
      "field-only",
      "field-only",
      "equal",
      "equal",
    ]);
    expect(result.fieldDifferences).toEqual([
      {
        index: 0,
        relocation: "HI16",
        fieldMask: 0xffff,
        target: 0x8001,
        generated: 0,
      },
      {
        index: 1,
        relocation: "LO16",
        fieldMask: 0xffff,
        target: 0x2000,
        generated: 0,
      },
    ]);
    expect(result.generated[0]?.fieldMask).toBe(0xffff);
    expect(result.target[0]?.fieldMask).toBe(0);
  });

  it("omits provenance when the generated words have none", () => {
    const result = compareFunction(functionFromWords("f", [0]), {
      kind: "linked",
      words: [0],
    });

    expect(result.generated).toEqual([
      { index: 0, word: 0, text: "nop", fieldMask: 0 },
    ]);
  });
});

describe("operand classification", () => {
  const cases: [string, string, string, Mismatch["kind"][]][] = [
    ["register", "addiu $2,$4,5", "addiu $2,$5,5", ["REGISTER"]],
    ["immediate", "addiu $2,$4,5", "addiu $2,$4,6", ["IMMEDIATE"]],
    ["shift amount", "sll $2,$4,2", "sll $2,$4,3", ["IMMEDIATE"]],
    ["memory offset", "lw $2,4($4)", "lw $2,8($4)", ["MEMORY_OFFSET"]],
    ["base register", "lw $2,4($4)", "lw $2,4($5)", ["REGISTER"]],
    ["opcode", "addu $2,$4,$5", "subu $2,$4,$5", ["OPCODE"]],
    [
      "register and immediate",
      "addiu $2,$4,5",
      "addiu $3,$4,6",
      ["REGISTER", "IMMEDIATE"],
    ],
    ["coprocessor register", "mfc2 $2,$9", "mfc2 $2,$10", ["REGISTER"]],
  ];

  it.each(cases)(
    "classifies a changed %s",
    (_name, target, generated, expected) => {
      const result = compare(linkedTarget([target, ...RETURN]), [
        generated,
        ...RETURN,
      ]);

      expect(result.exact).toBe(false);
      expect(kinds(result.mismatches)).toEqual(expected);
      expect(result.mismatches[0]).toMatchObject({
        targetRange: { start: 0, end: 1 },
        generatedRange: { start: 0, end: 1 },
        confidence: 1,
      });
      expect(result.alignment[0]?.mismatchIds).toEqual(
        result.mismatches.map((mismatch) => mismatch.id),
      );
    },
  );
});

describe("load and store classification", () => {
  it("classifies signed char (lb) against plain char (lbu) as LOAD_SIGNEDNESS", () => {
    const result = compare(linkedTarget(["lb $2,4($4)", ...RETURN]), [
      "lbu $2,4($4)",
      ...RETURN,
    ]);

    expect(result.mismatches).toEqual([
      {
        id: "LOAD_SIGNEDNESS@t0g0",
        kind: "LOAD_SIGNEDNESS",
        targetRange: { start: 0, end: 1 },
        generatedRange: { start: 0, end: 1 },
        confidence: 1,
        evidence: [
          "Target uses lb; your output uses lbu. Check the signedness of this 8-bit value.",
        ],
      },
    ]);
    expect(result.summary.byKind).toEqual({ LOAD_SIGNEDNESS: 1 });
  });

  it("classifies an int load (lw) against a signed char load (lb) as LOAD_WIDTH", () => {
    const result = compare(linkedTarget(["lw $2,4($4)", ...RETURN]), [
      "lb $2,4($4)",
      ...RETURN,
    ]);

    expect(kinds(result.mismatches)).toEqual(["LOAD_WIDTH"]);
  });

  it("reports a changed offset alongside a load width", () => {
    const result = compare(linkedTarget(["lw $2,0($4)", ...RETURN]), [
      "lb $2,4($4)",
      ...RETURN,
    ]);

    expect(kinds(result.mismatches)).toEqual(["LOAD_WIDTH", "MEMORY_OFFSET"]);
  });

  it("classifies an int store (sw) against a signed char store (sb) as STORE_WIDTH", () => {
    const result = compare(linkedTarget(["sw $5,4($4)", ...RETURN]), [
      "sb $5,4($4)",
      ...RETURN,
    ]);

    expect(kinds(result.mismatches)).toEqual(["STORE_WIDTH"]);
  });

  it("reports a changed register alongside a store width", () => {
    const result = compare(linkedTarget(["sw $5,4($4)", ...RETURN]), [
      "sb $6,4($4)",
      ...RETURN,
    ]);

    expect(kinds(result.mismatches)).toEqual(["STORE_WIDTH", "REGISTER"]);
  });

  it("classifies a load against a store as OPCODE", () => {
    const result = compare(linkedTarget(["lw $5,4($4)", ...RETURN]), [
      "sw $5,4($4)",
      ...RETURN,
    ]);

    expect(kinds(result.mismatches)).toEqual(["OPCODE"]);
    expect(result.mismatches[0]?.evidence).toEqual([
      expect.stringMatching(
        /^The instructions differ\. Target: lw .*; yours: sw .*\.$/,
      ),
    ]);
  });

  it("names an aliased instruction in OPCODE evidence as the listing shows it", () => {
    const result = compare(linkedTarget(["addiu $2,$4,5", ...RETURN]), [
      "addu $2,$4,$0",
      ...RETURN,
    ]);

    expect(kinds(result.mismatches)).toEqual(["OPCODE"]);
    const [evidence] = result.mismatches[0]?.evidence ?? [];
    expect(evidence).toContain("yours: move $v0,$a0");
    expect(evidence).not.toContain("addu");
  });
});

describe("inserted and removed instructions", () => {
  it("classifies an added instruction as EXTRA_INSTRUCTION", () => {
    const result = compare(linkedTarget(["addiu $2,$4,5", ...RETURN]), [
      "addiu $2,$4,5",
      "addiu $2,$2,1",
      ...RETURN,
    ]);

    expect(result.mismatches).toEqual([
      {
        id: "EXTRA_INSTRUCTION@t1g1",
        kind: "EXTRA_INSTRUCTION",
        targetRange: { start: 1, end: 1 },
        generatedRange: { start: 1, end: 2 },
        confidence: 1,
        evidence: [
          "Your output has addiu $v0,$v0,0x1 here; the target does not.",
        ],
      },
    ]);
    expect(result.score).toBe(3 / 4);
  });

  it("classifies a removed instruction as MISSING_INSTRUCTION", () => {
    const result = compare(
      linkedTarget(["addiu $2,$4,5", "addiu $2,$2,1", ...RETURN]),
      ["addiu $2,$4,5", ...RETURN],
    );

    expect(result.mismatches).toEqual([
      {
        id: "MISSING_INSTRUCTION@t1g1",
        kind: "MISSING_INSTRUCTION",
        targetRange: { start: 1, end: 2 },
        generatedRange: { start: 1, end: 1 },
        confidence: 1,
        evidence: [
          "The target has addiu $v0,$v0,0x1 here; your output does not.",
        ],
      },
    ]);
  });

  it("groups consecutive added instructions into one mismatch", () => {
    const result = compare(linkedTarget(["addiu $2,$4,5", ...RETURN]), [
      "addiu $2,$4,5",
      "addiu $2,$2,1",
      "addiu $2,$2,2",
      ...RETURN,
    ]);

    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]).toMatchObject({
      kind: "EXTRA_INSTRUCTION",
      generatedRange: { start: 1, end: 3 },
    });
  });
});

describe("unexplained differences", () => {
  it("returns UNKNOWN with evidence for a word that is not an instruction", () => {
    const result = compareFunction(
      functionFromWords("f", [0x24820005, 0x03e00008, 0]),
      { kind: "linked", words: [0xffffffff, 0x03e00008, 0] },
    );

    expect(result.mismatches).toEqual([
      {
        id: "UNKNOWN@t0g0",
        kind: "UNKNOWN",
        targetRange: { start: 0, end: 1 },
        generatedRange: { start: 0, end: 1 },
        confidence: 0,
        evidence: [
          "Target: .word 0xFFFFFFFF; yours: addiu $v0,$a0,0x5.",
          "Words: target 0xffffffff, yours 0x24820005.",
        ],
      },
    ]);
  });

  it("returns UNKNOWN for a word with reserved bits set", () => {
    // sll with a nonzero rs field is not a valid instruction.
    const result = compareFunction(functionFromWords("f", [0x00200000]), {
      kind: "linked",
      words: [0],
    });

    expect(kinds(result.mismatches)).toEqual(["UNKNOWN"]);
    expect(result.mismatches[0]?.evidence).toEqual([
      "Target: nop; yours: .word 0x00200000.",
      "Words: target 0x00000000, yours 0x00200000.",
    ]);
  });
});

describe("branches, jumps, and calls", () => {
  it("returns BRANCH_TARGET for a changed branch displacement", () => {
    const result = compare(
      linkedTarget([
        "beq $4,$5,.Lx",
        "addiu $2,$0,1",
        "addiu $2,$0,2",
        ".Lx:",
        ...RETURN,
      ]),
      ["beq $4,$5,.Lx", "addiu $2,$0,1", ".Lx:", "addiu $2,$0,2", ...RETURN],
    );

    expect(kinds(result.mismatches)).toEqual(["BRANCH_TARGET"]);
    expect(result.mismatches[0]?.evidence[0]).toMatch(
      /^Branch targets differ\. Target: /,
    );
  });

  it("returns BRANCH_TARGET for a changed jump target index", () => {
    // j 0x4 against j 0x8.
    const result = compareFunction(functionFromWords("f", [0x08000002, 0]), {
      kind: "linked",
      words: [0x08000001, 0],
    });

    expect(kinds(result.mismatches)).toEqual(["BRANCH_TARGET"]);
    expect(result.mismatches[0]?.evidence[0]).toMatch(/^Jump targets differ\./);
  });

  it("returns CALL_TARGET for a changed linked call index", () => {
    // jal 0x4 against jal 0x8.
    const result = compareFunction(functionFromWords("f", [0x0c000002, 0]), {
      kind: "linked",
      words: [0x0c000001, 0],
    });

    expect(kinds(result.mismatches)).toEqual(["CALL_TARGET"]);
    expect(result.mismatches[0]?.evidence[0]).toMatch(/^Call targets differ\./);
  });

  it("returns CALL_TARGET for an unlinked call to a different function", () => {
    const result = compare(unlinkedTarget(["jal g", ...RETURN]), [
      "jal h",
      ...RETURN,
    ]);

    expect(result.exact).toBe(false);
    expect(kinds(result.mismatches)).toEqual(["CALL_TARGET"]);
    expect(result.mismatches[0]?.evidence).toEqual([
      "Call targets differ.",
      "Target relocates MIPS26 g here; your output does not.",
      "Your output relocates MIPS26 h here; the target does not.",
    ]);
  });

  it("returns BRANCH_CONDITION for a different branch on the same registers", () => {
    const branch = (mnemonic: string) => [
      `${mnemonic} $4,$5,.Lx`,
      "addiu $2,$0,1",
      ".Lx:",
      ...RETURN,
    ];
    const result = compare(linkedTarget(branch("beq")), branch("bne"));

    expect(kinds(result.mismatches)).toEqual(["BRANCH_CONDITION"]);
    expect(result.mismatches[0]?.evidence[0]).toMatch(
      /^The branch conditions differ\. Target: beq /,
    );
  });

  it("does not report registers for branches that take different register counts", () => {
    const result = compare(
      linkedTarget(["bgez $4,.Lx", "addiu $2,$0,1", ".Lx:", ...RETURN]),
      ["beq $4,$5,.Lx", "addiu $2,$0,1", ".Lx:", ...RETURN],
    );

    expect(kinds(result.mismatches)).toEqual(["BRANCH_CONDITION"]);
  });

  it("still reports registers for same-shaped branches", () => {
    const result = compare(
      linkedTarget(["beq $4,$5,.Lx", "addiu $2,$0,1", ".Lx:", ...RETURN]),
      ["bne $4,$6,.Lx", "addiu $2,$0,1", ".Lx:", ...RETURN],
    );

    expect(kinds(result.mismatches)).toEqual(["BRANCH_CONDITION", "REGISTER"]);
  });
});

describe("instruction order", () => {
  it("returns one INSTRUCTION_ORDER for swapped instructions of the same kind", () => {
    const result = compare(
      linkedTarget(["addiu $2,$4,1", "addiu $3,$5,2", ...RETURN]),
      ["addiu $3,$5,2", "addiu $2,$4,1", ...RETURN],
    );

    expect(result.mismatches).toEqual([
      {
        id: "INSTRUCTION_ORDER@t0g0",
        kind: "INSTRUCTION_ORDER",
        targetRange: { start: 0, end: 2 },
        generatedRange: { start: 0, end: 2 },
        confidence: 1,
        evidence: [
          "The same instructions appear in a different order. Target: addiu $v0,$a0,0x1; addiu $v1,$a1,0x2. Yours: addiu $v1,$a1,0x2; addiu $v0,$a0,0x1.",
        ],
      },
    ]);
    expect(result.alignment.slice(0, 2).map((row) => row.mismatchIds)).toEqual([
      ["INSTRUCTION_ORDER@t0g0"],
      ["INSTRUCTION_ORDER@t0g0"],
    ]);
  });

  it("returns one INSTRUCTION_ORDER for a swap around an unchanged instruction", () => {
    const result = compare(
      linkedTarget([
        "addiu $2,$4,1",
        "sll $6,$6,1",
        "addiu $3,$5,2",
        ...RETURN,
      ]),
      ["addiu $3,$5,2", "sll $6,$6,1", "addiu $2,$4,1", ...RETURN],
    );

    expect(result.mismatches).toMatchObject([
      {
        id: "INSTRUCTION_ORDER@t0g0",
        targetRange: { start: 0, end: 3 },
        generatedRange: { start: 0, end: 3 },
      },
    ]);
    expect(result.alignment.map((row) => row.mismatchIds.length)).toEqual([
      1, 0, 1, 0, 0,
    ]);
  });

  it("returns one INSTRUCTION_ORDER for an instruction moved past an unrelated one", () => {
    const result = compare(
      linkedTarget(["addiu $2,$4,1", "sll $3,$5,2", ...RETURN]),
      ["sll $3,$5,2", "addiu $2,$4,1", ...RETURN],
    );

    expect(kinds(result.mismatches)).toEqual(["INSTRUCTION_ORDER"]);
    expect(result.mismatches[0]?.evidence).toEqual([
      "The same instructions appear in a different place: sll $v1,$a1,2.",
    ]);
  });

  it("pairs a missing instruction with the nearer of two extra copies", () => {
    const result = compare(
      linkedTarget([
        "xor $9,$9,$9",
        "sll $3,$5,2",
        "lw $6,0($7)",
        "lw $8,4($7)",
        ...RETURN,
      ]),
      [
        "sll $3,$5,2",
        "xor $9,$9,$9",
        "lw $6,0($7)",
        "lw $8,4($7)",
        "sll $3,$5,2",
        ...RETURN,
      ],
    );

    expect(result.mismatches.map((mismatch) => mismatch.id)).toEqual([
      "INSTRUCTION_ORDER@t0g0",
      "EXTRA_INSTRUCTION@t4g4",
    ]);
  });

  it("leaves changed pairs that are not a reordering alone", () => {
    const result = compare(
      linkedTarget(["addiu $2,$4,1", "addiu $3,$5,2", ...RETURN]),
      ["addiu $3,$5,2", "addiu $2,$4,7", ...RETURN],
    );

    expect(kinds(result.mismatches)).not.toContain("INSTRUCTION_ORDER");
  });

  it("does not pair a missing nop with an extra nop elsewhere", () => {
    const result = compare(
      linkedTarget([
        ".set noreorder",
        "nop",
        "addiu $2,$4,1",
        "addiu $3,$5,2",
        "j $31",
        "nop",
      ]),
      [
        ".set noreorder",
        "addiu $2,$4,1",
        "addiu $3,$5,2",
        "nop",
        "j $31",
        "nop",
      ],
    );

    expect(kinds(result.mismatches)).toEqual([
      "MISSING_INSTRUCTION",
      "EXTRA_INSTRUCTION",
    ]);
  });
});

describe("gp-relative data", () => {
  // A 4-byte common symbol is small data at -G 8 and absolute at -G 0.
  const LOAD = [".comm g,4", "lw $2,g", ...RETURN];

  it("returns one GP_RELATIVE when the target reaches data through $gp", () => {
    const result = compare(linkedTarget(LOAD, 8), LOAD);

    expect(kinds(result.mismatches)).toEqual(["GP_RELATIVE"]);
    expect(result.mismatches[0]?.evidence[0]).toBe(
      "The target reaches this data through $gp; your output does not.",
    );
    expect(
      result.alignment.every(
        (row) => row.status === "equal" || row.mismatchIds.length === 1,
      ),
    ).toBe(true);
  });

  it("returns one GP_RELATIVE when only the generated side uses $gp", () => {
    const result = compareFunction(generatedFrom(LOAD, 8), linkedTarget(LOAD));

    expect(kinds(result.mismatches)).toEqual(["GP_RELATIVE"]);
    expect(result.mismatches[0]?.evidence[0]).toBe(
      "Your output reaches this data through $gp; the target does not.",
    );
  });

  it("folds relocation differences into GP_RELATIVE for unlinked targets", () => {
    const result = compare(unlinkedTarget(LOAD, 8), LOAD);

    expect(result.exact).toBe(false);
    expect(kinds(result.mismatches)).toEqual(["GP_RELATIVE"]);
  });

  it("matches when both sides use $gp", () => {
    const result = compareFunction(
      generatedFrom(LOAD, 8),
      unlinkedTarget(LOAD, 8),
    );

    expect(result.exact).toBe(true);
  });
});

describe("hazard nops with two nearby causes", () => {
  it("links the nop to the nearest cause, preferring the earlier row on a tie", () => {
    const result = compare(
      linkedTarget(["lw $3,32($5)", "lb $2,4($5)", ...RETURN]),
      ["lw $3,32($4)", "lb $2,4($3)", ...RETURN],
    );

    expect(kinds(result.mismatches)).toEqual([
      "REGISTER",
      "EXTRA_INSTRUCTION",
      "REGISTER",
    ]);
    expect(result.mismatches[1]?.consequenceOf).toBe("REGISTER@t0g0");
  });
});

describe("delay slots", () => {
  it("classifies a nop inserted into the target's filled delay slot as DELAY_SLOT", () => {
    const result = compare(
      linkedTarget([
        ".set noreorder",
        "j $31",
        "addiu $2,$4,5",
        ".set reorder",
      ]),
      ["j $31", "addiu $2,$4,5"],
    );

    expect(result.mismatches).toEqual([
      {
        id: "DELAY_SLOT@t1g1",
        kind: "DELAY_SLOT",
        targetRange: { start: 1, end: 1 },
        generatedRange: { start: 1, end: 2 },
        confidence: 1,
        evidence: [
          "Your output has nop here; the target does not.",
          "branch-delay-nop: the delay slot of jr under .set reorder.",
        ],
      },
    ]);
  });

  it("classifies a missing word after a jump as DELAY_SLOT", () => {
    const result = compare(linkedTarget(["j $31", "addiu $2,$4,5"]), [
      ".set noreorder",
      "j $31",
      "addiu $2,$4,5",
      ".set reorder",
    ]);

    expect(kinds(result.mismatches)).toEqual(["DELAY_SLOT"]);
    expect(result.mismatches[0]?.targetRange).toEqual({ start: 1, end: 2 });
  });

  it("classifies a slot that one side fills and the other leaves empty as DELAY_SLOT", () => {
    const result = compare(
      linkedTarget([
        ".set noreorder",
        "j $31",
        "addiu $2,$4,5",
        ".set reorder",
      ]),
      [".set noreorder", "j $31", "nop", ".set reorder"],
    );

    expect(kinds(result.mismatches)).toEqual(["DELAY_SLOT"]);
    expect(result.mismatches[0]?.evidence).toEqual([
      "One delay slot is empty. Target: addiu $v0,$a0,0x5; yours: nop.",
    ]);
  });

  it("classifies a changed instruction in a delay slot by its operands", () => {
    const result = compare(
      linkedTarget([
        ".set noreorder",
        "j $31",
        "addiu $2,$4,5",
        ".set reorder",
      ]),
      [".set noreorder", "j $31", "addiu $2,$4,6", ".set reorder"],
    );

    expect(kinds(result.mismatches)).toEqual(["IMMEDIATE"]);
  });
});

describe("inserted nops", () => {
  it("reports a load-delay nop as a consequence of the register change that caused it", () => {
    const result = compare(
      linkedTarget(["lw $3,32($4)", "lb $2,4($5)", ...RETURN]),
      ["lw $3,32($4)", "lb $2,4($3)", ...RETURN],
    );

    expect(result.mismatches).toEqual([
      {
        id: "EXTRA_INSTRUCTION@t1g1",
        kind: "EXTRA_INSTRUCTION",
        targetRange: { start: 1, end: 1 },
        generatedRange: { start: 1, end: 2 },
        confidence: 1,
        evidence: [
          "Your output has nop here; the target does not.",
          "load-delay-nop: $3 is written by lw and read by lb.",
          "This nop follows from REGISTER@t1g2.",
        ],
        consequenceOf: "REGISTER@t1g2",
      },
      {
        id: "REGISTER@t1g2",
        kind: "REGISTER",
        targetRange: { start: 1, end: 2 },
        generatedRange: { start: 2, end: 3 },
        confidence: 1,
        evidence: [
          "Registers differ. Target: lb $v0,0x4($a1); yours: lb $v0,0x4($v1).",
        ],
      },
    ]);
  });

  it("reports a hazard nop with no nearby cause normally, with its note", () => {
    const generated = generatedFrom(["lw $3,32($4)", "lb $2,4($3)", ...RETURN]);
    const words = generated.words.map((word) => word.word);
    const result = compareFunction(generated, {
      kind: "linked",
      words: [...words.slice(0, 1), ...words.slice(2)],
    });

    expect(result.mismatches).toEqual([
      expect.objectContaining({
        kind: "EXTRA_INSTRUCTION",
        evidence: [
          "Your output has nop here; the target does not.",
          "load-delay-nop: $3 is written by lw and read by lb.",
        ],
      }),
    ]);
    expect(result.mismatches[0]).not.toHaveProperty("consequenceOf");
  });

  it("does not link a nop the player wrote, or one without provenance", () => {
    const written = compare(linkedTarget(["addiu $2,$4,5", ...RETURN]), [
      "addiu $2,$4,5",
      "nop",
      ...RETURN,
    ]);
    const bare = compareFunction(
      functionFromWords("f", [0x24820005, 0, 0x03e00008, 0]),
      { kind: "linked", words: [0x24820005, 0x03e00008, 0] },
    );

    expect(written.mismatches[0]).not.toHaveProperty("consequenceOf");
    expect(bare.mismatches[0]).not.toHaveProperty("consequenceOf");
  });

  it("ignores nearby mismatches that do not change register use", () => {
    const generated: GeneratedFunction = {
      name: "f",
      words: [
        { word: 0x8c830020, mask: 0, origin: undefined },
        {
          word: 0,
          mask: 0,
          origin: { line: 1, kind: "load-delay-nop", note: "test" },
        },
        { word: 0xffffffff, mask: 0, origin: undefined },
      ],
      relocations: [],
    };
    const result = compareFunction(generated, {
      kind: "linked",
      words: [0x8c830020, 0xfffffffe],
    });

    expect(kinds(result.mismatches)).toEqual(["EXTRA_INSTRUCTION", "UNKNOWN"]);
    expect(result.mismatches[0]).not.toHaveProperty("consequenceOf");
  });
});

describe("relocations of unlinked targets", () => {
  it("reports la g against la g+4, whose words are identical, as RELOCATION_TARGET", () => {
    const result = compare(unlinkedTarget(["la $2,g+4", ...RETURN]), [
      "la $2,g",
      ...RETURN,
    ]);

    expect(result.exact).toBe(false);
    expect(result.mismatches).toEqual([
      {
        id: "RELOCATION_TARGET@t0g0",
        kind: "RELOCATION_TARGET",
        targetRange: { start: 0, end: 1 },
        generatedRange: { start: 0, end: 1 },
        confidence: 1,
        evidence: [
          "Target relocates HI16 g+4 here; your output does not.",
          "Your output relocates HI16 g here; the target does not.",
        ],
      },
      expect.objectContaining({
        id: "RELOCATION_TARGET@t1g1",
        kind: "RELOCATION_TARGET",
      }),
    ]);
    expect(result.alignment[0]?.mismatchIds).toEqual([
      "RELOCATION_TARGET@t0g0",
    ]);
    expect(result.summary.equalWords).toBe(2);
    expect(result.score).toBe(2 / 4);
  });

  it("reports a different relocation symbol as RELOCATION_TARGET", () => {
    const result = compare(unlinkedTarget(["la $2,h", ...RETURN]), [
      "la $2,g",
      ...RETURN,
    ]);

    expect(result.exact).toBe(false);
    expect(result.summary.byKind).toEqual({ RELOCATION_TARGET: 2 });
  });

  it("reports a relocation the target lacks as RELOCATION_TARGET", () => {
    const words = wordsOf(["la $2,g", ...RETURN]);
    const result = compare({ kind: "unlinked", words, relocations: [] }, [
      "la $2,g",
      ...RETURN,
    ]);

    expect(result.exact).toBe(false);
    expect(result.mismatches.map((mismatch) => mismatch.evidence)).toEqual([
      ["Your output relocates HI16 g here; the target does not."],
      ["Your output relocates LO16 g here; the target does not."],
    ]);
  });

  it("accepts equal relocations as exact", () => {
    const lines = ["la $2,g+4", ...RETURN];

    expect(compare(unlinkedTarget(lines), lines).exact).toBe(true);
  });

  it("places a relocation past the generated words on the target row", () => {
    const result = compareFunction(functionFromWords("f", [0x03e00008, 0]), {
      kind: "unlinked",
      words: [0x03e00008, 0, 0],
      relocations: [
        {
          offset: 8,
          kind: "WORD32",
          fieldMask: 0xffffffff,
          fieldValue: 0,
          target: { kind: "symbol", name: "g", addend: 0 },
        },
      ],
    });

    expect(result.mismatches).toContainEqual(
      expect.objectContaining({
        id: "RELOCATION_TARGET@t2g2",
        targetRange: { start: 2, end: 3 },
        generatedRange: { start: 2, end: 2 },
      }),
    );
    // On a tie the last target nop pairs with the generated nop, so the
    // word removed is the one in the jump's delay slot.
    expect(result.alignment[1]).toEqual({
      status: "deleted",
      target: 1,
      mismatchIds: ["DELAY_SLOT@t1g1"],
    });
    expect(result.alignment[2]).toEqual({
      status: "equal",
      target: 2,
      generated: 1,
      mismatchIds: ["RELOCATION_TARGET@t2g2"],
    });
  });
});

describe("matchFunction", () => {
  const object = assembleObject(
    functionSource("g", ["addiu $2,$4,5", ...RETURN]),
    functionSource("h", ["la $2,x", ...RETURN]),
  );

  it("returns function-missing with the functions that were found", () => {
    expect(matchFunction(object, "f", { kind: "linked", words: [0] })).toEqual({
      kind: "function-missing",
      symbol: "f",
      definedFunctions: ["g", "h"],
    });
  });

  it("matches a function that is not first in its object", () => {
    const outcome = matchFunction(
      object,
      "h",
      unlinkedTarget(["la $2,x", ...RETURN]),
    );

    expect(outcome.kind === "matched" && outcome.result.exact).toBe(true);
  });

  it("accepts no assembly text: only an object, a symbol, and target words", () => {
    expectTypeOf(matchFunction).parameters.toEqualTypeOf<
      [AssembledObject, string, MatchTarget]
    >();
    expectTypeOf(matchFunction).returns.toEqualTypeOf<MatchOutcome>();
    expectTypeOf<MatchTarget["words"]>().toEqualTypeOf<ArrayLike<number>>();
    expectTypeOf(compareFunction).parameters.toEqualTypeOf<
      [GeneratedFunction, MatchTarget]
    >();
  });
});

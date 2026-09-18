import { describe, expect, it } from "vitest";
import { generatedFrom, wordsOf } from "./fixtures.test-helpers.ts";
import { abiRegisterNames, usesStack, wordFacts } from "./scan.ts";

// Every assembly fixture here is OSP-authored.

describe("wordFacts", () => {
  it("reads a load's registers, base, offset, width, and signedness", () => {
    const facts = wordFacts(wordsOf(["lw $2,0($4)", "j $31"]));

    expect(facts[0]).toEqual({
      index: 0,
      reads: ["$a0"],
      writes: ["$v0"],
      memory: {
        kind: "load",
        register: "$v0",
        base: "$a0",
        offset: 0,
        bytes: 4,
        signed: true,
      },
    });
    expect(facts[1]).toMatchObject({ reads: ["$ra"], writes: [] });
    expect(facts[1]?.memory).toBeUndefined();
    // The branch-delay nop the assembler inserted touches nothing.
    expect(facts[2]).toEqual({ index: 2, reads: [], writes: [] });
  });

  it("reads a branch's registers and resolves its distance to a word", () => {
    const facts = wordFacts(
      wordsOf(["bne $4,$5,skip", "addiu $2,$0,1", "skip:", "j $31"]),
    );

    // The listing prints the distance in bytes from the branch's own row, so
    // a row is four. The label lands at word 3 rather than 2 because the
    // assembler inserted a branch-delay nop ahead of it.
    expect(facts[0]?.branch).toEqual({
      registers: ["$a0", "$a1"],
      displacement: 12,
      target: 3,
    });
    expect(facts[1]?.branch).toBeUndefined();
  });

  it("reads a branch that tests one register against zero", () => {
    const facts = wordFacts(wordsOf(["bltz $4,skip", "nop", "skip:", "j $31"]));

    expect(facts[0]?.branch).toEqual({
      registers: ["$a0"],
      displacement: 12,
      target: 3,
    });
  });

  it("resolves a jump from its relocation, since the word holds 0x0", () => {
    const generated = generatedFrom([
      "beq $4,$0,other",
      "j done",
      "addiu $2,$5,1",
      "other:",
      "addiu $2,$5,-1",
      "done:",
      "j $31",
    ]);
    const words = generated.words.map((word) => word.word);
    const facts = wordFacts(words, generated.relocations);
    const jump = facts.findIndex((word) => word.jump !== undefined);

    expect(jump).toBeGreaterThan(0);
    expect(facts[jump]?.jump).toEqual({
      target: facts.findIndex(
        (word, index) => index > jump + 1 && word.reads.includes("$ra"),
      ),
    });
    // Without the relocations there is nothing to read the destination from.
    expect(wordFacts(words).some((word) => word.jump !== undefined)).toBe(
      false,
    );
  });

  it("names a call's callee from its relocation, since the word holds 0x0", () => {
    const generated = generatedFrom([
      "addiu $29,$29,-24",
      "sw $31,16($29)",
      "jal helper",
      "nop",
      "lw $31,16($29)",
      "addiu $29,$29,24",
      "j $31",
    ]);
    const words = generated.words.map((word) => word.word);
    const facts = wordFacts(words, generated.relocations);

    expect(facts[2]?.call).toEqual({ callee: "helper" });
    expect(facts[2]?.jump).toBeUndefined();
    expect(wordFacts(words)[2]?.call).toBeUndefined();
  });

  it("links an access to the earlier load that set its base register", () => {
    const facts = wordFacts(
      wordsOf(["lw $3,32($4)", "lb $2,4($3)", "sw $2,0($3)", "j $31"]),
    );
    const accesses = facts.filter((word) => word.memory !== undefined);

    expect(
      accesses.map(({ index, memory, baseWrittenBy }) => [
        index,
        memory?.kind,
        memory?.base,
        memory?.offset,
        memory?.bytes,
        baseWrittenBy,
      ]),
    ).toEqual([
      [0, "load", "$a0", 32, 4, undefined],
      // The assembler inserts load-delay nops at words 1 and 3: each next
      // instruction reads the register just loaded.
      [2, "load", "$v1", 4, 1, 0],
      [4, "store", "$v1", 0, 4, 0],
    ]);
    expect(accesses[2]?.memory).not.toHaveProperty("signed");
  });

  it.each([
    ["lbu $2,5($4)", { kind: "load", bytes: 1, signed: false }],
    ["lh $2,2($4)", { kind: "load", bytes: 2, signed: true }],
    ["sb $5,1($4)", { kind: "store", bytes: 1, register: "$a1" }],
    ["sh $5,2($4)", { kind: "store", bytes: 2 }],
  ])("describes %s", (line, expected) => {
    expect(wordFacts(wordsOf([line, "j $31"]))[0]?.memory).toMatchObject(
      expected,
    );
  });

  it("reports no memory access for arithmetic or an undecodable word", () => {
    const [add, ...rest] = wordFacts([
      ...wordsOf(["addiu $2,$4,5"]),
      0xfc000000,
    ]);

    expect(add).toEqual({ index: 0, reads: ["$a0"], writes: ["$v0"] });
    expect(rest.at(-1)).toMatchObject({ reads: [], writes: [] });
    expect(rest.at(-1)?.memory).toBeUndefined();
  });
});

describe("usesStack", () => {
  it("is true only when a word writes the stack pointer", () => {
    expect(usesStack(wordFacts(wordsOf(["addiu $29,$29,-8", "j $31"])))).toBe(
      true,
    );
    expect(usesStack(wordFacts(wordsOf(["lw $2,0($29)", "j $31"])))).toBe(
      false,
    );
  });
});

describe("abiRegisterNames", () => {
  it("writes numeric register names as listings show them", () => {
    expect(abiRegisterNames("$3 is written by lw and read by lb")).toBe(
      "$v1 is written by lw and read by lb",
    );
    expect(abiRegisterNames("$0, $29, $31, $4")).toBe("$zero, $sp, $ra, $a0");
  });

  it("leaves other text and out-of-range numbers alone", () => {
    expect(abiRegisterNames("$v0 costs $32 or $3a")).toBe(
      "$v0 costs $32 or $3a",
    );
  });
});

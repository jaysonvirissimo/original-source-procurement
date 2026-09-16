import { encode } from "psyq-asm";
import { describe, expect, it } from "vitest";
import {
  difficultyOf,
  featureTags,
  functionFacts,
  FEATURE_TAGS,
} from "./analysis.ts";

/** OSP-authored instruction sequences, assembled word by word. */
function words(
  ...instructions: readonly Parameters<typeof encode>[0][]
): number[] {
  return instructions.map((instruction) => encode(instruction));
}

const gpr = (number: number) => ({ kind: "gpr", number }) as const;
const imm = (value: number) =>
  ({ kind: "imm", value, bits: 16, signed: true }) as const;
const mem = (base: number, offset: number) =>
  ({ kind: "mem", base, offset }) as const;
const nop = {
  mnemonic: "sll",
  operands: [gpr(0), gpr(0), { kind: "shamt", value: 0 }],
} as const;

const RETURN_FIVE = words(
  { mnemonic: "jr", operands: [gpr(31)] },
  { mnemonic: "addiu", operands: [gpr(2), gpr(0), imm(5)] },
);

describe("functionFacts", () => {
  it("counts a jump, its filled delay slot, and the blocks it makes", () => {
    const facts = functionFacts(RETURN_FIVE);
    expect(facts.words).toBe(2);
    expect(facts.jumps).toBe(1);
    expect(facts.filledDelaySlots).toBe(1);
    expect(facts.nops).toBe(0);
    expect(facts.basicBlocks).toBe(1);
  });

  it("counts an unfilled delay slot as a nop, not as filled", () => {
    const facts = functionFacts(
      words({ mnemonic: "jr", operands: [gpr(31)] }, nop),
    );
    expect(facts.nops).toBe(1);
    expect(facts.filledDelaySlots).toBe(0);
  });

  it("separates loads by width and signedness", () => {
    const facts = functionFacts(
      words(
        { mnemonic: "lb", operands: [gpr(2), mem(4, 0)] },
        { mnemonic: "lbu", operands: [gpr(3), mem(4, 1)] },
        { mnemonic: "lw", operands: [gpr(5), mem(4, 4)] },
      ),
    );
    expect(facts.loads).toBe(3);
    expect(facts.loadForms).toBe(3);
    expect(facts.signedLoads).toBe(1);
    expect(facts.narrowAccesses).toBe(2);
    expect(facts.fieldAccesses).toBe(2);
  });

  it("tells a stack access from a struct field access", () => {
    const facts = functionFacts(
      words(
        { mnemonic: "sw", operands: [gpr(31), mem(29, 20)] },
        { mnemonic: "sw", operands: [gpr(2), mem(4, 8)] },
      ),
    );
    expect(facts.stackAccesses).toBe(1);
    expect(facts.fieldAccesses).toBe(1);
    expect(facts.stores).toBe(2);
    expect(facts.storeForms).toBe(1);
  });

  it("counts a backward branch as a loop and splits the blocks", () => {
    const facts = functionFacts(
      words(
        { mnemonic: "addiu", operands: [gpr(2), gpr(2), imm(-1)] },
        {
          mnemonic: "bne",
          operands: [gpr(2), gpr(0), { kind: "branch", displacement: -2 }],
        },
        nop,
      ),
    );
    expect(facts.branches).toBe(1);
    expect(facts.loops).toBe(1);
  });

  it("starts a new block after a forward branch and at its target", () => {
    const facts = functionFacts(
      words(
        {
          mnemonic: "beq",
          operands: [gpr(2), gpr(0), { kind: "branch", displacement: 1 }],
        },
        nop,
        { mnemonic: "addiu", operands: [gpr(2), gpr(0), imm(1)] },
        { mnemonic: "addiu", operands: [gpr(3), gpr(0), imm(2)] },
      ),
    );
    expect(facts.loops).toBe(0);
    expect(facts.basicBlocks).toBe(2);
  });

  it("counts a call", () => {
    expect(
      functionFacts(
        words(
          { mnemonic: "jal", operands: [{ kind: "target", index: 0 }] },
          nop,
        ),
      ).calls,
    ).toBe(1);
  });

  it("notices a word that decodes to no instruction", () => {
    expect(functionFacts([0xffffffff]).words).toBe(1);
  });

  it("counts multiply-divide and coprocessor work", () => {
    const facts = functionFacts(
      words(
        { mnemonic: "mult", operands: [gpr(4), gpr(5)] },
        { mnemonic: "mflo", operands: [gpr(2)] },
        {
          mnemonic: "lwc2",
          operands: [
            { kind: "cop", number: 0, unit: 2, space: "data" },
            mem(4, 0),
          ],
        },
      ),
    );
    expect(facts.multiplyDivide).toBe(2);
    expect(facts.coprocessor).toBe(1);
    // A coprocessor transfer reads memory, but it is not one of the loads a
    // mission compares by width or signedness.
    expect(facts.loads).toBe(0);
    expect(facts.fieldAccesses).toBe(0);
  });

  it("counts the assembler's own temporary register", () => {
    expect(
      functionFacts(words({ mnemonic: "lui", operands: [gpr(1), imm(1)] }))
        .assemblerTemporary,
    ).toBe(1);
    expect(functionFacts(RETURN_FIVE).assemblerTemporary).toBe(0);
  });
});

describe("difficultyOf", () => {
  it("scores every axis from the facts and the context", () => {
    const profile = difficultyOf(functionFacts(RETURN_FIVE), 14);
    expect(profile.size).toBe(2);
    expect(profile.context).toBe(14);
    expect(profile.specialHardware).toBe(0);
    expect(profile.controlFlow).toBeGreaterThan(0);
  });

  it("is deterministic", () => {
    const facts = functionFacts(RETURN_FIVE);
    expect(difficultyOf(facts, 3)).toEqual(difficultyOf(facts, 3));
  });
});

describe("featureTags", () => {
  it("reports the tags in their published order", () => {
    const tags = featureTags(
      functionFacts(
        words(
          { mnemonic: "sw", operands: [gpr(31), mem(29, 20)] },
          { mnemonic: "jal", operands: [{ kind: "target", index: 0 }] },
          { mnemonic: "lb", operands: [gpr(2), mem(4, 8)] },
        ),
      ),
    );
    expect(tags).toEqual(FEATURE_TAGS.filter((tag) => tags.includes(tag)));
    expect(tags).toContain("call");
    expect(tags).toContain("stack-frame");
    expect(tags).toContain("signed-load");
  });

  it("reports nothing for a function that only returns", () => {
    expect(
      featureTags(
        functionFacts(words({ mnemonic: "jr", operands: [gpr(31)] }, nop)),
      ),
    ).toEqual([]);
  });
});

import { encode } from "psyq-asm";
import { describe, expect, it } from "vitest";
import {
  difficultyOf,
  earlyFieldCandidate,
  featureTags,
  functionFacts,
  linkedCallAddress,
  FEATURE_TAGS,
} from "./analysis.ts";
import { SAMPLE_FACTS } from "./testing.ts";

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
    expect(facts.narrowLoads).toBe(2);
    expect(facts.narrowStores).toBe(0);
    expect(facts.narrowAccesses).toBe(2);
    expect(facts.fieldAccesses).toBe(2);
  });

  it("counts narrow stores apart from narrow loads", () => {
    const facts = functionFacts(
      words(
        { mnemonic: "lbu", operands: [gpr(2), mem(4, 0)] },
        { mnemonic: "sh", operands: [gpr(5), mem(4, 2)] },
        { mnemonic: "sw", operands: [gpr(6), mem(4, 4)] },
      ),
    );
    expect(facts.narrowLoads).toBe(1);
    expect(facts.narrowStores).toBe(1);
    expect(facts.narrowAccesses).toBe(2);
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

  it("tells an argument-based access from a global-pointer one", () => {
    const facts = functionFacts(
      words(
        { mnemonic: "lw", operands: [gpr(2), mem(4, 8)] },
        { mnemonic: "sw", operands: [gpr(2), mem(28, 16)] },
      ),
    );
    expect(facts.argumentBaseAccesses).toBe(1);
    expect(facts.gpAccesses).toBe(1);
    expect(facts.absoluteAccesses).toBe(0);
    expect(facts.upperImmediates).toBe(0);
    // Both still read as offset accesses, which is what the older count saw.
    expect(facts.fieldAccesses).toBe(2);
  });

  it("counts an access through an address built with an upper immediate", () => {
    const facts = functionFacts(
      words(
        { mnemonic: "lui", operands: [gpr(2), imm(0x1234)] },
        { mnemonic: "lw", operands: [gpr(3), mem(2, 0x10)] },
      ),
    );
    expect(facts.absoluteAccesses).toBe(1);
    expect(facts.upperImmediates).toBe(1);
    expect(facts.argumentBaseAccesses).toBe(0);
    expect(facts.gpAccesses).toBe(0);
  });

  it("counts an access that loads into the register it was based on", () => {
    expect(
      functionFacts(
        words(
          { mnemonic: "lui", operands: [gpr(2), imm(0x1234)] },
          { mnemonic: "lw", operands: [gpr(2), mem(2, 0x10)] },
          { mnemonic: "lw", operands: [gpr(3), mem(2, 4)] },
        ),
      ).absoluteAccesses,
    ).toBe(1);
  });

  it("stops treating a register as absolute once something else writes it", () => {
    const facts = functionFacts(
      words(
        { mnemonic: "lui", operands: [gpr(2), imm(0x1234)] },
        { mnemonic: "addiu", operands: [gpr(2), gpr(4), imm(8)] },
        { mnemonic: "lw", operands: [gpr(3), mem(2, 4)] },
      ),
    );
    expect(facts.absoluteAccesses).toBe(0);
    expect(facts.argumentBaseAccesses).toBe(0);
  });

  it("counts no base for a stack access", () => {
    const facts = functionFacts(
      words({ mnemonic: "sw", operands: [gpr(31), mem(29, 20)] }),
    );
    expect(facts.stackAccesses).toBe(1);
    expect(facts.argumentBaseAccesses).toBe(0);
    expect(facts.gpAccesses).toBe(0);
    expect(facts.absoluteAccesses).toBe(0);
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

describe("earlyFieldCandidate", () => {
  it("accepts loads, stores, and the return jump", () => {
    expect(
      earlyFieldCandidate({ ...SAMPLE_FACTS, stores: 2, narrowLoads: 1 }),
    ).toBe(true);
  });

  it("accepts a field reached through a pointer the function loaded", () => {
    // Neither access is based on an argument register once the chain starts,
    // and following one is taught before the field missions.
    expect(
      earlyFieldCandidate({
        ...SAMPLE_FACTS,
        loads: 2,
        fieldAccesses: 2,
        argumentBaseAccesses: 1,
      }),
    ).toBe(true);
  });

  it.each([
    "narrowStores",
    "gpAccesses",
    "absoluteAccesses",
    "calls",
    "branches",
    "loops",
    "stackAccesses",
  ] as const)(
    "accepts a function with %s, which the course now teaches",
    (fact) => {
      expect(earlyFieldCandidate({ ...SAMPLE_FACTS, [fact]: 1 })).toBe(true);
    },
  );

  it.each(["coprocessor", "multiplyDivide", "assemblerTemporary"] as const)(
    "rejects a function with %s",
    (fact) => {
      expect(earlyFieldCandidate({ ...SAMPLE_FACTS, [fact]: 1 })).toBe(false);
    },
  );
});

describe("linkedCallAddress", () => {
  // OSP-authored words and addresses.
  it("puts the word's field under the top bits of the next row", () => {
    // jal 0x80010040 from the first row of a function at 0x80010000.
    expect(linkedCallAddress(0x0c004010, 0x80010000, 0)).toBe(0x80010040);
  });

  it("takes the top bits from the row after the call, not the call", () => {
    // A call in the last row of one 256 MB region reaches into the next.
    expect(linkedCallAddress(0x0c000010, 0x8ffffff8, 1)).toBe(0x90000040);
  });
});

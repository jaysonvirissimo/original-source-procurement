import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { functionFromWords } from "./extract.ts";
import { compareFunction } from "./match.ts";
import type { FunctionRelocation } from "./types.ts";

const WORD = fc.integer({ min: 0, max: 0xffff_ffff });
const MASKS = [0xffff, 0x03ff_ffff, 0xffff_ffff] as const;

/** Mostly words that decode to ordinary instructions, plus arbitrary words. */
const INSTRUCTION_WORD = fc.oneof(
  fc.constantFrom(
    0,
    0x03e00008,
    0x24820005,
    0x24820006,
    0x80830004,
    0x90830004,
    0x8c830004,
    0xa0850004,
    0xac850004,
    0x00851021,
    0x00851023,
    0x10850002,
  ),
  WORD,
);

const WORDS = fc.array(INSTRUCTION_WORD, { maxLength: 16 });

/** Words, relocations on some of them, and target words that differ only inside those fields. */
const RELOCATED = WORDS.chain((words) =>
  fc
    .tuple(
      fc.array(fc.option(fc.constantFrom(...MASKS), { nil: undefined }), {
        minLength: words.length,
        maxLength: words.length,
      }),
      fc.array(WORD, { minLength: words.length, maxLength: words.length }),
    )
    .map(([masks, noise]) => {
      const relocations: FunctionRelocation[] = masks.flatMap((mask, index) =>
        mask === undefined
          ? []
          : [
              {
                offset: index * 4,
                kind: "WORD32" as const,
                fieldMask: mask,
                fieldValue: 0,
                target: { kind: "symbol" as const, name: "g", addend: 0 },
              },
            ],
      );
      const linked = words.map((word, index) => {
        const mask = masks[index] ?? 0;
        return ((word & ~mask) | ((noise[index] ?? 0) & mask)) >>> 0;
      });
      return { words, relocations, linked };
    }),
);

describe("matching properties", () => {
  it("is reflexive: bits inside relocated fields never affect exactness", () => {
    fc.assert(
      fc.property(RELOCATED, ({ words, relocations, linked }) => {
        const generated = functionFromWords("f", words, relocations);

        expect(
          compareFunction(generated, { kind: "linked", words: linked }).exact,
        ).toBe(true);
        expect(
          compareFunction(generated, { kind: "unlinked", words, relocations })
            .exact,
        ).toBe(true);
      }),
    );
  });

  it("aligns identical sequences with zero mismatches", () => {
    fc.assert(
      fc.property(WORDS, (words) => {
        const result = compareFunction(functionFromWords("f", words), {
          kind: "linked",
          words,
        });

        expect(result.mismatches).toEqual([]);
        expect(result.alignment.map((row) => row.status)).toEqual(
          words.map(() => "equal"),
        );
        expect(result.score).toBe(1);
      }),
    );
  });

  it("is deterministic", () => {
    fc.assert(
      fc.property(WORDS, WORDS, (target, generated) => {
        const run = () =>
          compareFunction(functionFromWords("f", generated), {
            kind: "linked",
            words: target,
          });

        expect(run()).toEqual(run());
      }),
    );
  });

  it("covers every word once, in order, and explains every difference", () => {
    fc.assert(
      fc.property(WORDS, WORDS, (target, generated) => {
        const result = compareFunction(functionFromWords("f", generated), {
          kind: "linked",
          words: target,
        });
        const ids = result.mismatches.map((mismatch) => mismatch.id);

        expect(
          result.alignment.flatMap((row) =>
            row.target === undefined ? [] : [row.target],
          ),
        ).toEqual(target.map((_, index) => index));
        expect(
          result.alignment.flatMap((row) =>
            row.generated === undefined ? [] : [row.generated],
          ),
        ).toEqual(generated.map((_, index) => index));
        expect(new Set(ids).size).toBe(ids.length);
        for (const row of result.alignment) {
          expect(row.status === "equal" || row.mismatchIds.length > 0).toBe(
            true,
          );
          for (const id of row.mismatchIds) {
            expect(ids).toContain(id);
          }
        }
        expect(result.exact).toBe(result.mismatches.length === 0);
      }),
    );
  });
});

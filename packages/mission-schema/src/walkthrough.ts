import { z } from "zod";
import { InstructionRangeSchema } from "./hint.ts";
import { SkillIdSchema, TextSchema } from "./primitives.ts";

/**
 * One step of a walkthrough, optionally tied to target words. A step
 * without a range describes something the listing does not contain, such as
 * the caller resuming.
 */
export const WalkthroughStepSchema = z.strictObject({
  range: InstructionRangeSchema.optional(),
  text: TextSchema,
});
export type WalkthroughStep = z.infer<typeof WalkthroughStepSchema>;

const BIT_WIDTHS = [8, 16, 32] as const;
export type BitWidth = (typeof BIT_WIDTHS)[number];

/** How a bit row follows from an earlier row of the same diagram. */
export const BitDerivationSchema = z.discriminatedUnion("op", [
  z.strictObject({
    op: z.literal("shl"),
    from: z.number().int().min(0),
    amount: z.number().int().min(1).max(31),
  }),
  z.strictObject({
    op: z.enum(["sign-extend", "zero-extend"]),
    from: z.number().int().min(0),
  }),
]);
export type BitDerivation = z.infer<typeof BitDerivationSchema>;

export const BitRowSchema = z.strictObject({
  label: TextSchema,
  width: z.union(BIT_WIDTHS.map((width) => z.literal(width))),
  /** The bit pattern, written as an unsigned number. */
  value: z.number().int().min(0).max(0xffff_ffff),
  derive: BitDerivationSchema.optional(),
});
export type BitRow = z.infer<typeof BitRowSchema>;

export const CallerRowSchema = z.strictObject({
  /** A caller variable, a register such as `$a0`, or a memory cell. */
  name: TextSchema,
  /** Omitted when the value is not set yet or does not matter. */
  before: z.number().int().min(-0x8000_0000).max(0xffff_ffff).optional(),
  after: z.number().int().min(-0x8000_0000).max(0xffff_ffff).optional(),
  note: TextSchema.optional(),
});
export type CallerRow = z.infer<typeof CallerRowSchema>;

const common = {
  /** The walkthrough in words, so no information exists only in a table. */
  caption: TextSchema,
  /** The skill whose help level decides when it shows under the listing. */
  skill: SkillIdSchema.optional(),
};

/**
 * A static teaching diagram over a mission's target. Values are authored
 * examples or follow from decoded words; nothing executes.
 */
export const MissionWalkthroughSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("trace"),
    ...common,
    steps: z.array(WalkthroughStepSchema).min(2),
  }),
  z.strictObject({
    kind: z.literal("timeline"),
    ...common,
    lanes: z
      .array(
        z.strictObject({
          label: TextSchema,
          steps: z.array(WalkthroughStepSchema).min(1),
        }),
      )
      .min(1),
  }),
  z.strictObject({
    kind: z.literal("bits"),
    ...common,
    rows: z.array(BitRowSchema).min(1),
  }),
  z.strictObject({
    kind: z.literal("caller"),
    ...common,
    /** OSP-authored C that calls the mission's function. */
    code: TextSchema,
    rows: z.array(CallerRowSchema).min(1),
  }),
  z.strictObject({
    kind: z.literal("operands"),
    ...common,
    /** The target word whose operands are labeled. */
    word: z.number().int().min(0),
  }),
]);
export type MissionWalkthrough = z.infer<typeof MissionWalkthroughSchema>;

type Report = (path: readonly (string | number)[], message: string) => void;

function mask(width: BitWidth): number {
  return width === 32 ? 0xffff_ffff : 2 ** width - 1;
}

/** The pattern a derived row must hold, or undefined when it cannot apply. */
export function derivedBits(
  source: Pick<BitRow, "width" | "value">,
  derive: BitDerivation,
  width: BitWidth,
): number | undefined {
  if (derive.op === "shl") {
    return Number(
      (BigInt(source.value) << BigInt(derive.amount)) & BigInt(mask(width)),
    );
  }
  if (source.width > width) {
    return undefined;
  }
  const negative = source.value >= 2 ** (source.width - 1);
  if (derive.op === "zero-extend" || !negative) {
    return source.value;
  }
  return (mask(width) - mask(source.width) + source.value) >>> 0;
}

/** Checks a walkthrough against its mission's target word count and skills. */
export function checkWalkthrough(
  walkthrough: MissionWalkthrough,
  at: readonly (string | number)[],
  wordCount: number,
  listedSkills: ReadonlySet<string>,
  report: Report,
): void {
  if (walkthrough.skill !== undefined && !listedSkills.has(walkthrough.skill)) {
    report(
      [...at, "skill"],
      "A walkthrough's skill must be one the mission teaches or practices.",
    );
  }
  const checkSteps = (
    steps: readonly WalkthroughStep[],
    path: readonly (string | number)[],
  ) => {
    steps.forEach((step, index) => {
      if (step.range !== undefined && step.range.end > wordCount) {
        report(
          [...path, index, "range"],
          "A walkthrough step must stay inside the target function.",
        );
      }
    });
  };
  switch (walkthrough.kind) {
    case "trace":
      checkSteps(walkthrough.steps, [...at, "steps"]);
      return;
    case "timeline": {
      const labels = walkthrough.lanes.map(({ label }) => label);
      if (new Set(labels).size !== labels.length) {
        report([...at, "lanes"], "Each lane has its own label.");
      }
      walkthrough.lanes.forEach((lane, index) => {
        checkSteps(lane.steps, [...at, "lanes", index, "steps"]);
      });
      return;
    }
    case "bits":
      walkthrough.rows.forEach((row, index) => {
        const path = [...at, "rows", index];
        if (row.value > mask(row.width)) {
          report([...path, "value"], "A bit row's value must fit its width.");
        }
        if (row.derive === undefined) {
          return;
        }
        const source = walkthrough.rows[row.derive.from];
        const expected =
          source === undefined || row.derive.from >= index
            ? undefined
            : derivedBits(source, row.derive, row.width);
        if (expected === undefined) {
          report(
            [...path, "derive"],
            "A derived row follows an earlier row that is no wider.",
          );
        } else if (expected !== row.value) {
          report(
            [...path, "value"],
            "A derived row's value must follow from its source row.",
          );
        }
      });
      return;
    case "caller": {
      const names = walkthrough.rows.map(({ name }) => name);
      if (new Set(names).size !== names.length) {
        report([...at, "rows"], "Each caller row has its own name.");
      }
      return;
    }
    case "operands":
      if (walkthrough.word >= wordCount) {
        report(
          [...at, "word"],
          "The labeled word must be inside the target function.",
        );
      }
      return;
  }
}

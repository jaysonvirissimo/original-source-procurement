import { z } from "zod";
import { SkillIdSchema, TextSchema, Uint32Schema } from "./primitives.ts";

/** A general-purpose register by its ABI name, as listings show it. */
export const RegisterNameSchema = z
  .string()
  .regex(
    /^\$(?:zero|at|v[01]|a[0-3]|t[0-9]|s[0-7]|k[01]|gp|sp|fp|ra)$/,
    "Expected an ABI register name, such as $a0.",
  );

/** A 32-bit value, written signed or unsigned as reads best. */
const WordValueSchema = z.number().int().min(-0x8000_0000).max(0xffff_ffff);

/** One value in an example region, at a byte offset from its start. */
export const ExampleCellSchema = z.strictObject({
  offset: z.number().int().min(0).max(0x7fff),
  size: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  /** The C name of the value, such as `c` or `*p`. */
  label: TextSchema,
  value: WordValueSchema,
  /** The region whose address this cell holds. */
  pointsTo: TextSchema.optional(),
});
export type ExampleCell = z.infer<typeof ExampleCellSchema>;

export const ExampleRegionSchema = z.strictObject({
  /** Names the region, such as `struct Obj`. */
  label: TextSchema,
  address: Uint32Schema,
  cells: z.array(ExampleCellSchema).min(1),
});
export type ExampleRegion = z.infer<typeof ExampleRegionSchema>;

/**
 * Made-up values a mission's machine diagrams use to show addresses and
 * contents. They illustrate the target's instructions; nothing executes.
 */
export const MissionExampleSchema = z.strictObject({
  /** The diagram in words, so no information exists only in the picture. */
  caption: TextSchema,
  /** The skill whose help level decides when the diagram shows. */
  skill: SkillIdSchema.optional(),
  /** Register values when the function starts. */
  registers: z.array(
    z.strictObject({
      register: RegisterNameSchema,
      value: WordValueSchema,
      note: TextSchema.optional(),
    }),
  ),
  regions: z.array(ExampleRegionSchema),
});
export type MissionExample = z.infer<typeof MissionExampleSchema>;

type Report = (path: readonly (string | number)[], message: string) => void;

const SIZE_RANGES: Readonly<Record<ExampleCell["size"], [number, number]>> = {
  1: [-0x80, 0xff],
  2: [-0x8000, 0xffff],
  4: [-0x8000_0000, 0xffff_ffff],
};

/** Checks that an example is internally consistent. */
export function checkExample(
  example: MissionExample,
  listedSkills: ReadonlySet<string>,
  report: Report,
): void {
  if (example.skill !== undefined && !listedSkills.has(example.skill)) {
    report(
      ["example", "skill"],
      "An example's skill must be one the mission teaches or practices.",
    );
  }
  const registers = example.registers.map(({ register }) => register);
  if (new Set(registers).size !== registers.length) {
    report(["example", "registers"], "Each register appears once.");
  }
  const regions = new Map(
    example.regions.map((region) => [region.label, region]),
  );
  if (regions.size !== example.regions.length) {
    report(["example", "regions"], "Each region has its own label.");
  }
  example.regions.forEach((region, regionIndex) => {
    let end = 0;
    region.cells.forEach((cell, cellIndex) => {
      const path = ["example", "regions", regionIndex, "cells", cellIndex];
      if (cell.offset < end) {
        report(
          path,
          "Cells are listed by offset and must not overlap the cell before.",
        );
      }
      end = cell.offset + cell.size;
      const [min, max] = SIZE_RANGES[cell.size];
      if (cell.value < min || cell.value > max) {
        report([...path, "value"], "A cell's value must fit in its size.");
      }
      if ((region.address + cell.offset) % cell.size !== 0) {
        report(
          [...path, "offset"],
          "A cell's address must be aligned to its size.",
        );
      }
      if (cell.pointsTo !== undefined) {
        const pointee = regions.get(cell.pointsTo);
        if (
          pointee === undefined ||
          cell.size !== 4 ||
          cell.value !== pointee.address
        ) {
          report(
            [...path, "pointsTo"],
            "A pointer cell is 4 bytes and holds the address of a region in the example.",
          );
        }
      }
    });
  });
}

import { wordFacts } from "@osp/matching-core";
import type { MissionExample } from "@osp/mission-schema";
import { describe, expect, it } from "vitest";
import {
  inlineWords,
  shippedMission,
} from "../workspace/workspace.test-helpers";
import { memoryDiagram, registerDiagram } from "./diagrams";

// lw $v0,0x0($a0); jr $ra; nop
const loadWord = wordFacts(inlineWords(shippedMission("006")));
// lw $v1,0x20($a0); nop; lb $v0,0x4($v1); jr $ra; sw $v0,0x0($v1)
const qualification = wordFacts(inlineWords(shippedMission("012")));

const pointerExample: MissionExample = {
  caption: "p holds address 0x1000; memory there holds 42.",
  registers: [{ register: "$a0", value: 0x1000, note: "p" }],
  regions: [
    {
      label: "int at p",
      address: 0x1000,
      cells: [{ offset: 0, size: 4, label: "*p", value: 42 }],
    },
  ],
};

const chainExample: MissionExample = {
  caption: "h points at a Holder whose inner field points at an Inner.",
  registers: [{ register: "$a0", value: 0x3000 }],
  regions: [
    {
      label: "struct Holder",
      address: 0x3000,
      cells: [
        {
          offset: 0x20,
          size: 4,
          label: "inner",
          value: 0x4000,
          pointsTo: "struct Inner",
        },
      ],
    },
    {
      label: "struct Inner",
      address: 0x4000,
      cells: [
        { offset: 0, size: 4, label: "x", value: 7 },
        { offset: 4, size: 1, label: "level", value: -3 },
      ],
    },
  ],
};

describe("registerDiagram", () => {
  it("lists the example's registers first, with the words that read and write each", () => {
    expect(registerDiagram(loadWord, pointerExample)).toEqual([
      { register: "$a0", value: 0x1000, note: "p", readBy: [0], writtenBy: [] },
      { register: "$v0", readBy: [], writtenBy: [0] },
      { register: "$ra", readBy: [1], writtenBy: [] },
    ]);
  });

  it("lists registers in order of use without an example", () => {
    expect(
      registerDiagram(qualification, undefined).map(({ register }) => register),
    ).toEqual(["$a0", "$v1", "$v0", "$ra"]);
  });
});

describe("memoryDiagram", () => {
  it("finds a cell from a base register's example value", () => {
    const diagram = memoryDiagram(loadWord, pointerExample);

    expect(diagram.unresolved).toEqual([]);
    expect(diagram.regions).toEqual([
      {
        label: "int at p",
        address: 0x1000,
        rows: [
          {
            cell: { offset: 0, size: 4, label: "*p", value: 42 },
            address: 0x1000,
            accesses: [
              {
                index: 0,
                access: expect.objectContaining({
                  kind: "load",
                  bytes: 4,
                }) as object,
              },
            ],
          },
        ],
      },
    ]);
  });

  it("follows a pointer cell an earlier load read", () => {
    const diagram = memoryDiagram(qualification, chainExample);

    expect(diagram.unresolved).toEqual([]);
    expect(
      diagram.regions.flatMap(({ rows }) =>
        rows.map(({ cell, address, accesses }) => [
          cell.label,
          address,
          accesses.map(
            ({ index, access }) => `${String(index)}:${access.kind}`,
          ),
        ]),
      ),
    ).toEqual([
      ["inner", 0x3020, ["0:load"]],
      ["x", 0x4000, ["4:store"]],
      ["level", 0x4004, ["2:load"]],
    ]);
  });

  it("leaves accesses unresolved when the example does not lead to their address", () => {
    const noPointer: MissionExample = {
      ...chainExample,
      regions: chainExample.regions.map((region) => ({
        ...region,
        cells: region.cells.map(({ offset, size, label, value }) => ({
          offset,
          size,
          label,
          value,
        })),
      })),
    };
    expect(
      memoryDiagram(qualification, noPointer).unresolved.map(
        ({ index }) => index,
      ),
    ).toEqual([2, 4]);

    const noRegister = { ...pointerExample, registers: [] };
    expect(
      memoryDiagram(loadWord, noRegister).unresolved.map(({ index }) => index),
    ).toEqual([0]);

    const elsewhere = {
      ...pointerExample,
      registers: [{ register: "$a0", value: 0x2000 }],
    };
    expect(
      memoryDiagram(loadWord, elsewhere).regions[0]?.rows[0]?.accesses,
    ).toEqual([]);
  });
});

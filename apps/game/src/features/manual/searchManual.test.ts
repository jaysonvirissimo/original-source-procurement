import type { ManualEntry } from "@osp/mission-schema";
import { describe, expect, it } from "vitest";
import { groupBySection, searchManual } from "./searchManual";

const entries: ManualEntry[] = [
  {
    id: "glossary.register",
    section: "GLOSSARY",
    title: "register",
    body: ["A named storage slot."],
  },
  {
    id: "orientation.registers",
    section: "ORIENTATION",
    title: "Registers",
    body: ["$v0 carries the return value."],
  },
  {
    id: "abi.return-values",
    section: "ABI",
    title: "Return values",
    body: ["A function returns an int in the register $v0."],
  },
];

const ids = (found: readonly ManualEntry[]) => found.map((entry) => entry.id);

describe("searchManual", () => {
  it.each<[string, string, string[]]>([
    ["an empty query", "  ", []],
    [
      "title matches before body matches",
      "REGISTER",
      ["glossary.register", "orientation.registers", "abi.return-values"],
    ],
    [
      "every word, in any field",
      "return $v0",
      ["abi.return-values", "orientation.registers"],
    ],
    ["no match", "stack", []],
  ])("finds %s", (_name, query, expected) => {
    expect(ids(searchManual(entries, query))).toEqual(expected);
  });
});

describe("groupBySection", () => {
  it("groups in section order and skips empty sections", () => {
    expect(
      groupBySection(entries).map(({ section, entries: grouped }) => [
        section,
        ids(grouped),
      ]),
    ).toEqual([
      ["ORIENTATION", ["orientation.registers"]],
      ["ABI", ["abi.return-values"]],
      ["GLOSSARY", ["glossary.register"]],
    ]);
  });
});

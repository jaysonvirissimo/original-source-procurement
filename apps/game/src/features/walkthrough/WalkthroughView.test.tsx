import { wordFacts } from "@osp/matching-core";
import type { MissionWalkthrough } from "@osp/mission-schema";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  inlineWords,
  shippedMission,
} from "../workspace/workspace.test-helpers";
import { WalkthroughView } from "./WalkthroughView";

const mission = shippedMission("012");
const facts = wordFacts(inlineWords(mission));
const listing = [
  "lw $v1,0x20($a0)",
  "nop",
  "lb $v0,0x4($v1)",
  "jr $ra",
  "sw $v0,0x0($v1)",
];

function view(walkthrough: MissionWalkthrough, loaded = true) {
  render(
    <WalkthroughView
      walkthrough={walkthrough}
      listing={listing}
      facts={loaded ? facts : undefined}
    />,
  );
}

function rows(name: string): (string | null)[] {
  return within(screen.getByRole("table", { name }))
    .getAllByRole("row")
    .map((row) => row.textContent);
}

describe("WalkthroughView", () => {
  it("shows a timeline's lanes as captioned step tables", () => {
    view({
      kind: "timeline",
      caption: "Only the first load waits.",
      lanes: [
        {
          label: "Load delay",
          steps: [
            { range: { start: 0, end: 2 }, text: "Load, then wait." },
            { text: "Nothing else waits." },
          ],
        },
      ],
    });
    expect(screen.getByRole("heading", { name: "Timeline" })).toBeTruthy();
    expect(screen.getByText("Only the first load waits.")).toBeTruthy();
    expect(
      screen.getByText("Load delay", { selector: "caption" }),
    ).toBeTruthy();
    expect(rows("Timeline: Load delay")).toEqual([
      "StepWordsWhat happens",
      "1Words 0–1: lw $v1,0x20($a0); nopLoad, then wait.",
      "2—Nothing else waits.",
    ]);
  });

  it("shows bit rows in binary and hexadecimal", () => {
    view({
      kind: "bits",
      caption: "0xFD widened.",
      rows: [
        { label: "byte", width: 8, value: 0xfd },
        {
          label: "sign-extended",
          width: 32,
          value: 0xffff_fffd,
          derive: { op: "sign-extend", from: 0 },
        },
      ],
    });
    expect(rows("Bits")).toEqual([
      "ValueWidthBitsHex",
      "byte81111 11010xFD",
      "sign-extended321111 1111 1111 1111 1111 1111 1111 11010xFFFFFFFD",
    ]);
  });

  it("shows caller code and before/after values, addresses in hexadecimal", () => {
    view({
      kind: "caller",
      caption: "store_word(&x, 9) changes x.",
      code: "int x = 42;\nstore_word(&x, 9);",
      rows: [
        { name: "x", before: 42, after: 9 },
        { name: "$a0", before: 0x1000, note: "&x" },
        { name: "$v0", before: -3 },
      ],
    });
    expect(screen.getByText(/store_word\(&x, 9\);/)).toBeTruthy();
    expect(rows("From the caller")).toEqual([
      "NameBeforeAfterNote",
      "x429",
      "$a00x1000—&x",
      "$v0-3—",
    ]);
  });

  it("labels operands from decoded facts, and waits for the target", () => {
    const store: MissionWalkthrough = {
      kind: "operands",
      caption: "Read the store.",
      word: 4,
    };
    view(store);
    expect(
      screen.getByText(/write 4 bytes from \$v0 to memory at \$v1 \+ 0x0/),
    ).toBeTruthy();
    expect(rows("Reading the operands")[1]).toMatch(/^source\$v0Holds/);
  });

  it("says the target is not loaded before facts exist", () => {
    view({ kind: "operands", caption: "Read the load.", word: 0 }, false);
    expect(screen.getByText("The target is not loaded.")).toBeTruthy();
  });
});

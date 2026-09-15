import { wordFacts } from "@osp/matching-core";
import type { MissionExample } from "@osp/mission-schema";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  inlineWords,
  shippedMission,
} from "../workspace/workspace.test-helpers";
import { ScanPanel } from "./ScanPanel";

// lw $v1,0x20($a0); nop; lb $v0,0x4($v1); jr $ra; sw $v0,0x0($v1)
const qualification = wordFacts(inlineWords(shippedMission("012")));

const chain: MissionExample = {
  caption: "h points at a Holder; its inner field points at an Inner.",
  registers: [{ register: "$a0", value: 0x3000, note: "h" }],
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

function layer(name: string): void {
  fireEvent.click(screen.getByRole("radio", { name }));
}

function rows(tableName: string): (string | null)[] {
  return within(screen.getByRole("table", { name: tableName }))
    .getAllByRole("row")
    .map((row) => row.textContent);
}

describe("ScanPanel", () => {
  it("opens on the notes, lists each with its words, and closes", () => {
    const onClose = vi.fn();
    render(
      <ScanPanel
        annotations={[
          {
            range: { start: 1, end: 2 },
            label: "delay slot",
            text: "Runs before the jump takes effect.",
          },
          { range: { start: 0, end: 2 }, label: "note", text: "The function." },
        ]}
        facts={qualification}
        example={chain}
        onClose={onClose}
      />,
    );

    const scan = screen.getByRole("region", { name: "Scan" });
    expect(screen.getByRole("radio", { name: "Notes" })).toHaveProperty(
      "checked",
      true,
    );
    expect(
      within(screen.getByRole("list", { name: "Notes" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Word 1 · delay slotRuns before the jump takes effect.",
      "Words 0–1 · noteThe function.",
    ]);
    fireEvent.click(within(scan).getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows registers, memory with a pointer chain, and the stack, one layer at a time", () => {
    render(
      <ScanPanel
        annotations={[]}
        facts={qualification}
        example={chain}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("This target has no notes to scan.")).toBeTruthy();

    layer("Registers");
    expect(rows("Registers")).toEqual([
      "RegisterAt entryRead byWritten by",
      "$a00x3000 (h)word 0—",
      "$v1—words 2, 4word 0",
      "$v0—word 4word 2",
      "$ra—word 3—",
    ]);

    layer("Memory");
    expect(screen.getByText(chain.caption)).toBeTruthy();
    expect(rows("Memory: struct Holder")).toEqual([
      "AddressFieldBytesExample valueTarget words",
      "0x3020 (+32)inner40x4000, the address of struct InnerWord 0 loads 4 bytes into $v1",
    ]);
    expect(rows("Memory: struct Inner")).toEqual([
      "AddressFieldBytesExample valueTarget words",
      "0x4000 (+0)x47Word 4 stores 4 bytes from $v0",
      "0x4004 (+4)level1-3Word 2 loads 1 byte into $v0, sign-extended",
    ]);
    expect(screen.queryByRole("table", { name: "Registers" })).toBeNull();

    layer("Stack");
    expect(
      screen.getByText(
        "This function never changes $sp, so it has no stack frame.",
      ),
    ).toBeTruthy();
  });

  it("explains missing memory, unfollowed bases, an unloaded target, and a stack frame", () => {
    const { rerender } = render(
      <ScanPanel
        annotations={[]}
        facts={qualification}
        example={undefined}
        onClose={vi.fn()}
      />,
    );
    layer("Memory");
    expect(
      screen.getByText("This mission has no example memory."),
    ).toBeTruthy();

    rerender(
      <ScanPanel
        annotations={[]}
        facts={qualification}
        example={{ ...chain, registers: [] }}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        "Word 0 reads memory through $a0, which this example does not follow.",
      ),
    ).toBeTruthy();

    rerender(
      <ScanPanel
        annotations={[]}
        facts={wordFacts([0x27bdfff8, 0x03e00008, 0x27bd0008])}
        example={undefined}
        onClose={vi.fn()}
      />,
    );
    layer("Stack");
    expect(
      screen.getByText(/changes \$sp, so it has a stack frame/),
    ).toBeTruthy();

    rerender(
      <ScanPanel
        annotations={[]}
        facts={undefined}
        example={undefined}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("The target is not loaded.")).toBeTruthy();
  });
});

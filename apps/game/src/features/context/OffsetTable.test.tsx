import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { layoutRows } from "./layoutRows";
import { OffsetTable } from "./OffsetTable";
import type { TypeLayout } from "./offsetProbe";

// OSP-authored layouts.
const mixed: Extract<TypeLayout, { kind: "measured" }> = {
  kind: "measured",
  name: "struct Mixed",
  size: 16,
  fields: [
    { name: "tag", typeText: "char", kind: "scalar", offset: 0, size: 1 },
    { name: "count", typeText: "int", kind: "scalar", offset: 4, size: 4 },
    {
      name: "next",
      typeText: "struct Mixed *",
      kind: "pointer",
      offset: 8,
      size: 4,
    },
    {
      name: "in",
      typeText: "struct Pair",
      kind: "aggregate",
      offset: 12,
      size: 2,
    },
  ],
};

function region(): HTMLElement {
  return screen.getByRole("region", { name: "Field offsets" });
}

describe("layoutRows", () => {
  it("adds padding rows for skipped bytes, including at the end", () => {
    expect(
      layoutRows(mixed).map((row) =>
        row.kind === "padding"
          ? `pad ${String(row.offset)}+${String(row.size)}`
          : row.field.name,
      ),
    ).toEqual(["tag", "pad 1+3", "count", "next", "in", "pad 14+2"]);
  });

  it("does not count overlapping union members as padding", () => {
    expect(
      layoutRows({
        kind: "measured",
        name: "union U",
        size: 4,
        fields: [
          { name: "i", typeText: "int", kind: "scalar", offset: 0, size: 4 },
          { name: "c", typeText: "char", kind: "scalar", offset: 0, size: 1 },
        ],
      }).map((row) => row.kind),
    ).toEqual(["field", "field"]);
  });
});

describe("OffsetTable", () => {
  it("lists offsets in hex with sizes, types, kinds, and padding", () => {
    render(
      <OffsetTable
        state={{
          kind: "measured",
          types: [
            mixed,
            { kind: "unavailable", name: "Odd", reason: "it has a bit-field" },
          ],
        }}
      />,
    );
    const table = within(region()).getByRole("table", {
      name: "struct Mixed · 16 bytes",
    });
    expect(
      within(table)
        .getAllByRole("row")
        .map((row) =>
          Array.from(row.children, (cell) => cell.textContent).join("|"),
        ),
    ).toEqual([
      "Offset|Size|Field|Type|Kind",
      "0x0|1|tag|char|",
      "0x1|3|padding",
      "0x4|4|count|int|",
      "0x8|4|next|struct Mixed *|pointer",
      "0xC|2|in|struct Pair|embedded",
      "0xE|2|padding",
    ]);
    expect(region().textContent).toContain(
      "Offsets unavailable for Odd: it has a bit-field.",
    );
  });

  it("says when it is measuring", () => {
    render(<OffsetTable state={{ kind: "measuring" }} />);
    expect(within(region()).getByRole("status").textContent).toBe(
      "Measuring field offsets.",
    );
  });

  it("says offsets are unavailable, with diagnostics folded away", () => {
    const { rerender } = render(
      <OffsetTable
        state={{
          kind: "failed",
          message: "The offset probe did not compile.",
          diagnostics: [{ severity: "error", message: "parse error" }],
        }}
      />,
    );
    expect(region().textContent).toContain(
      "Offsets unavailable. The offset probe did not compile. Compile still works.",
    );
    expect(region().querySelector("details")?.open).toBe(false);
    expect(region().querySelector("pre")?.textContent).toBe("parse error");

    rerender(
      <OffsetTable
        state={{ kind: "failed", message: "worker gone", diagnostics: [] }}
      />,
    );
    expect(region().querySelector("details")).toBeNull();
  });
});

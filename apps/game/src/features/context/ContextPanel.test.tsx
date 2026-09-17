import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CompilationInput } from "../compiler/types";
import type { ContextState } from "../workspace/workspaceReducer";
import { ContextPanel } from "./ContextPanel";

// OSP-authored header text.
const input: CompilationInput = {
  filename: "sample.c",
  source: "",
  headers: {
    "psyq/include/pair.h": "typedef struct { int left; int right; } Pair;\n",
    "sample.h": "#include <pair.h>\nint sample(Pair *p);\n",
  },
  cppFlags: ["-Ipsyq/include"],
  rawFlags: [],
  gpSize: 8,
  aspsxVersion: "2.77",
  encoding: "utf8",
};

function ready(headers = input.headers): ContextState {
  return {
    kind: "ready",
    input: { ...input, headers },
    target: { kind: "linked", words: [] },
  };
}

function panel(context: ContextState, children?: ReactNode) {
  const onRetry = vi.fn();
  const onClose = vi.fn();
  render(
    <ContextPanel
      context={context}
      starterSource={'#include "sample.h"\n'}
      onRetry={onRetry}
      onClose={onClose}
    >
      {children}
    </ContextPanel>,
  );
  return {
    onRetry,
    onClose,
    region: screen.getByRole("region", { name: "Context" }),
  };
}

describe("ContextPanel", () => {
  it("shows every header whole, read-only, in include order", () => {
    const { region, onClose } = panel(ready(), <p>Offsets here</p>);

    const headers = within(region).getByRole("list", { name: "Headers" });
    expect(
      within(headers)
        .getAllByRole("listitem")
        .map((item) => item.querySelector("summary")?.textContent),
    ).toEqual(["sample.h", "psyq/include/pair.h"]);
    expect(
      within(region).getByLabelText("psyq/include/pair.h").textContent,
    ).toBe(input.headers["psyq/include/pair.h"]);
    expect(region.querySelector("details")?.open).toBe(true);
    expect(within(region).queryByRole("textbox")).toBeNull();
    expect(
      within(region)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Close"]);
    expect(within(region).getByText("Offsets here")).toBeTruthy();

    fireEvent.click(within(region).getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("says when a mission declares its types in the starting source", () => {
    const { region } = panel(ready({}));
    expect(region.textContent).toContain("This mission has no headers.");
  });

  it("says so while the headers load", () => {
    const { region } = panel({ kind: "resolving" });
    expect(within(region).getByRole("status").textContent).toBe(
      "Loading mission context.",
    );
  });

  it.each([
    ["unavailable", "couldn't reach them"],
    ["content-mismatch", "didn't match what it expected"],
  ] as const)("shows the %s state with Retry", (kind, copy) => {
    const { region, onRetry } = panel({ kind, path: "psyq/include/pair.h" });
    const alert = within(region).getByRole("alert");
    expect(alert.textContent).toContain(copy);
    expect(alert.textContent).toContain("psyq/include/pair.h");

    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

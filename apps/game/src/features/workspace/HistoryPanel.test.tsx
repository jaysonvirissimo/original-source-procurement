import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { attempt, timestamp } from "../persistence/persistence.test-helpers";
import type { Attempt } from "../persistence/schema";
import { HistoryPanel } from "./HistoryPanel";

function renderPanel(attempts: readonly Attempt[]) {
  const handlers = {
    onPin: vi.fn(),
    onRestore: vi.fn(),
    onClear: vi.fn(),
    onClose: vi.fn(),
  };
  render(<HistoryPanel attempts={attempts} {...handlers} />);
  return handlers;
}

function history(): HTMLElement {
  return screen.getByRole("region", { name: "History" });
}

function rows(): HTMLElement[] {
  return within(history()).getAllByRole("listitem");
}

describe("HistoryPanel", () => {
  it("explains history before the first comparison", () => {
    const { onClose } = renderPanel([]);

    expect(history().textContent).toContain("pin an attempt to keep it longer");
    expect(
      within(history()).queryByRole("button", { name: "Clear history" }),
    ).toBeNull();
    fireEvent.click(within(history()).getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("lists attempts newest first with their result", () => {
    renderPanel([
      attempt({ id: "old", createdAt: timestamp(1) }),
      attempt({ id: "same-a", createdAt: timestamp(3) }),
      attempt({ id: "exact", createdAt: timestamp(5), exact: true, score: 1 }),
      attempt({ id: "same-b", createdAt: timestamp(3) }),
    ]);

    expect(
      rows().map((row) => row.textContent.includes("EXACT MATCH")),
    ).toEqual([true, false, false, false]);
    expect(rows()[3]?.textContent).toContain("1 of 2 words match");
  });

  it("pins, unpins, and restores an attempt", () => {
    const pinned = attempt({
      id: "pinned",
      pinned: true,
      createdAt: timestamp(2),
    });
    const loose = attempt({ id: "loose", createdAt: timestamp(1) });
    const { onPin, onRestore } = renderPanel([loose, pinned]);
    const [first, second] = rows();
    if (first === undefined || second === undefined) {
      throw new Error("Expected two rows.");
    }

    const pinButton = within(first).getByRole("button", { name: "Pin" });
    expect(pinButton.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(pinButton);
    expect(onPin).toHaveBeenLastCalledWith("pinned", false);
    fireEvent.click(within(second).getByRole("button", { name: "Pin" }));
    expect(onPin).toHaveBeenLastCalledWith("loose", true);

    fireEvent.click(within(second).getByRole("button", { name: "Restore" }));
    expect(onRestore).toHaveBeenCalledWith(loose);
  });

  it("clears unpinned attempts after confirmation", () => {
    const { onClear } = renderPanel([
      attempt(),
      attempt({ id: "b", pinned: true }),
    ]);
    const inPanel = (name: string) =>
      within(history()).getByRole("button", { name });

    fireEvent.click(inPanel("Clear history"));
    expect(history().textContent).toContain("Pinned attempts stay.");
    fireEvent.click(inPanel("Keep history"));
    expect(onClear).not.toHaveBeenCalled();

    fireEvent.click(inPanel("Clear history"));
    fireEvent.click(inPanel("Clear"));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(inPanel("Clear history")).toBeTruthy();
  });

  it("offers no clearing when every attempt is pinned", () => {
    renderPanel([attempt({ pinned: true })]);

    expect(
      within(history()).queryByRole("button", { name: "Clear history" }),
    ).toBeNull();
  });
});

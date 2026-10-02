import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ManualEntryView } from "./ManualEntryView";

describe("ManualEntryView", () => {
  it("links each web address in a paragraph, opening in a new tab, and keeps the sentence's punctuation", () => {
    const paragraph =
      "The README is the source of truth: https://example.test/path. Then https://decomp.me/ too.";
    render(
      <ManualEntryView
        entry={{
          id: "field-guide.sample",
          section: "FIELD GUIDE",
          title: "Sample",
          body: [paragraph],
        }}
        level={2}
      />,
    );

    const first = screen.getByRole("link", {
      name: "https://example.test/path",
    });
    expect(first.getAttribute("href")).toBe("https://example.test/path");
    expect(first.getAttribute("target")).toBe("_blank");
    expect(first.getAttribute("rel")).toBe("noopener noreferrer");
    expect(
      screen
        .getByRole("link", { name: "https://decomp.me/" })
        .getAttribute("href"),
    ).toBe("https://decomp.me/");
    expect(screen.getByText(/The README is/).textContent).toBe(paragraph);
    expect(screen.getByText("FIELD GUIDE")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: "Sample" }),
    ).toBeTruthy();
  });

  it("renders a paragraph without an address as plain text", () => {
    render(
      <ManualEntryView
        entry={{
          id: "glossary.sample",
          section: "GLOSSARY",
          title: "sample",
          body: ["No address here. Nor here."],
        }}
        level={3}
        hideSection
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("No address here. Nor here.")).toBeTruthy();
    expect(screen.queryByText("GLOSSARY")).toBeNull();
  });
});

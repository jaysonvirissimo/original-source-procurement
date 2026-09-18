import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ToolchainProvider } from "../features/compiler/ToolchainProvider";
import { saveDataError } from "../features/persistence/errors";
import { emptyPlayerState } from "../features/persistence/schema";
import { samplePlayer } from "../features/persistence/persistence.test-helpers";
import { fakeToolchain } from "../test/fakeToolchain";
import { memoryProgress } from "../test/progressStorage";
import { App, RouteView } from "./App";

const createToolchain = () => Promise.resolve(fakeToolchain());

afterEach(() => {
  window.location.hash = "";
});

describe("App", () => {
  it("renders the OSP home route by default", async () => {
    render(<App openStorage={memoryProgress().openStorage} />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "OSP" }),
    ).toBeTruthy();
    expect(screen.getByText("Original Source Procurement")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Mission map" })).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "001 RETURN PATH" })
        .getAttribute("href"),
    ).toBe("#/mission/001");
  });

  it("offers the orientation first on a fresh save", async () => {
    render(<App openStorage={memoryProgress().openStorage} />);

    const start = await screen.findByRole("region", { name: "Start here" });
    expect(
      within(start)
        .getByRole("link", { name: "Read the orientation" })
        .getAttribute("href"),
    ).toBe("#/orientation");
    expect(
      within(screen.getByRole("navigation", { name: "Reference" }))
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["#/orientation", "#/manual", "#/settings"]);
  });

  it("keeps the orientation, manual, and settings one link away once missions are started", async () => {
    render(<App openStorage={memoryProgress(samplePlayer()).openStorage} />);

    const reference = await screen.findByRole("navigation", {
      name: "Reference",
    });
    expect(
      within(reference)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["#/orientation", "#/manual", "#/settings"]);
    expect(screen.queryByRole("region", { name: "Start here" })).toBeNull();
  });

  it("marks completed and started missions on the map", async () => {
    render(<App openStorage={memoryProgress(samplePlayer()).openStorage} />);

    const map = await screen.findByRole("region", { name: "Mission map" });
    const rowOf = (name: string) => {
      const row = within(map).getByRole("link", { name }).closest("li");
      if (row === null) {
        throw new Error(`No row holds ${name}.`);
      }
      return row;
    };
    expect(rowOf("001 RETURN PATH").textContent).toContain("COMPLETE");
    expect(rowOf("003 ADD IMMEDIATE").textContent).toContain("IN PROGRESS");
    expect(rowOf("002 ARGUMENT ZERO").textContent).not.toMatch(
      /COMPLETE|IN PROGRESS/,
    );
  });

  it("opens browser storage by default", async () => {
    // jsdom provides no IndexedDB, so the default storage cannot open.
    render(<App createToolchain={createToolchain} />);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "isn't letting OSP store data",
    );
  });

  it("explains when save data cannot load, keeping the footer", async () => {
    render(
      <App openStorage={() => Promise.reject(saveDataError("unavailable"))} />,
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "isn't letting OSP store data",
    );
    const footer = screen.getByRole("contentinfo");
    expect(
      within(footer).getByRole("link", { name: "Third-party notices" }),
    ).toBeTruthy();
    expect(
      within(footer)
        .getByRole("link", { name: "Settings" })
        .getAttribute("href"),
    ).toBe("#/settings");
  });

  it("links to settings and the third-party notices from the footer", () => {
    render(
      <App
        createToolchain={createToolchain}
        openStorage={memoryProgress().openStorage}
      />,
    );

    const footer = within(screen.getByRole("contentinfo"));
    expect(
      footer.getAllByRole("link").map((link) => link.getAttribute("href")),
    ).toEqual(["#/settings", "./THIRD_PARTY_NOTICES.txt"]);
  });

  it("follows hash navigation", async () => {
    render(
      <App
        createToolchain={createToolchain}
        openStorage={memoryProgress().openStorage}
      />,
    );
    await screen.findByRole("heading", { level: 1, name: "OSP" });

    act(() => {
      window.location.hash = "#/settings";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(
      screen.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeTruthy();
    expect(await screen.findByText("compiler-build")).toBeTruthy();
  });
});

describe("RouteView", () => {
  it("opens the requested mission's briefing", async () => {
    render(
      memoryProgress().wrap(
        <ToolchainProvider createToolchain={createToolchain}>
          <RouteView route={{ kind: "mission", missionId: "001" }} />
        </ToolchainProvider>,
      ),
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "RETURN PATH" }),
    ).toBeTruthy();
  });

  it("offers a way back from an unknown mission", async () => {
    render(
      memoryProgress().wrap(
        <RouteView route={{ kind: "mission", missionId: "999" }} />,
      ),
    );

    expect(
      (
        await screen.findByRole("link", { name: "Return to mission map" })
      ).getAttribute("href"),
    ).toBe("#/");
  });

  it("opens the whole manual and focuses the requested entry", () => {
    render(
      <RouteView route={{ kind: "manual", entryId: "glossary.register" }} />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Manual" }),
    ).toBeTruthy();
    expect(document.activeElement?.id).toBe("manual-glossary.register");
    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual([
      "ORIENTATION",
      "TOOLS",
      "C",
      "MIPS",
      "ABI",
      "MATCHING",
      "GLOSSARY",
    ]);
    expect(
      screen.getByRole("searchbox", { name: "Search the manual" }),
    ).toBeTruthy();
    expect(screen.queryByText(/No manual entry has that name/)).toBeNull();
  });

  it("aligns the requested entry again once the fonts have loaded", async () => {
    // The manual's fonts load with font-display: swap, so the first layout
    // uses fallback metrics and the text above the entry reflows when they
    // arrive. Focusing scrolls once, before that; the route has to align
    // again afterwards or a deep link lands past its entry. jsdom loads no
    // fonts, so the set is supplied here.
    let settle: (() => void) | undefined;
    const ready = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const scrolled: string[] = [];
    // jsdom implements no layout, so there is no scrollIntoView to spy on.
    Element.prototype.scrollIntoView = function recordScroll(this: Element) {
      scrolled.push(this.id);
    };
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready },
    });

    try {
      render(
        <RouteView route={{ kind: "manual", entryId: "glossary.register" }} />,
      );

      expect(document.activeElement?.id).toBe("manual-glossary.register");
      expect(scrolled).toEqual([]);

      settle?.();
      await act(async () => {
        await ready;
      });

      expect(scrolled).toEqual(["manual-glossary.register"]);
    } finally {
      Reflect.deleteProperty(Element.prototype, "scrollIntoView");
      Reflect.deleteProperty(document, "fonts");
    }
  });

  it("names an unknown manual entry and still shows the manual", () => {
    render(<RouteView route={{ kind: "manual", entryId: "MIPS.LOAD.WORD" }} />);

    expect(screen.getByText("MIPS.LOAD.WORD")).toBeTruthy();
    expect(
      screen.getByText(
        "No manual entry has that name. Search the manual, or browse every entry.",
      ),
    ).toBeTruthy();
    expect(document.activeElement).toBe(document.body);
  });

  it("opens the manual with no entry named", () => {
    render(<RouteView route={{ kind: "manual" }} />);

    expect(document.querySelector("code")).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it("reads the orientation in order and changes no progress", async () => {
    const progress = memoryProgress();
    render(progress.wrap(<RouteView route={{ kind: "orientation" }} />));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Orientation" }),
    ).toBeTruthy();
    const titles = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(titles[0]).toBe("What you are doing");
    expect(titles).toContain("Hexadecimal");
    expect(titles.at(-1)).toBe("Workspace tools");
    expect(
      screen
        .getByRole("link", { name: "Start mission 001: RETURN PATH" })
        .getAttribute("href"),
    ).toBe("#/mission/001");
    expect(
      screen
        .getByRole("link", { name: "Open the manual" })
        .getAttribute("href"),
    ).toBe("#/manual");
    expect(progress.backing.player).toEqual(emptyPlayerState());
  });

  it("renders settings with the save data and toolchain panels and no detail line", async () => {
    const { container } = render(
      memoryProgress().wrap(
        <ToolchainProvider createToolchain={createToolchain}>
          <RouteView route={{ kind: "settings" }} />
        </ToolchainProvider>,
      ),
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Settings" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: "Save data" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: "Toolchain" }),
    ).toBeTruthy();
    expect(await screen.findByText("compiler-build")).toBeTruthy();
    expect(container.querySelector("section > p > code")).toBeNull();
  });

  it("shows the unmatched path for an unknown route", () => {
    render(<RouteView route={{ kind: "not-found", path: "/nowhere" }} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Route not found" }),
    ).toBeTruthy();
    expect(screen.getByText("/nowhere")).toBeTruthy();
  });
});

import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ToolchainProvider } from "../features/compiler/ToolchainProvider";
import { saveDataError } from "../features/persistence/errors";
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
    expect(
      screen.getByRole("link", { name: "Third-party notices" }),
    ).toBeTruthy();
  });

  it("links to the third-party notices shipped with the build", () => {
    render(
      <App
        createToolchain={createToolchain}
        openStorage={memoryProgress().openStorage}
      />,
    );

    const link = screen.getByRole("link", { name: "Third-party notices" });
    expect(link.getAttribute("href")).toBe("./THIRD_PARTY_NOTICES.txt");
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

  it("names the requested manual entry", () => {
    render(<RouteView route={{ kind: "manual", entryId: "MIPS.LOAD.WORD" }} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Manual" }),
    ).toBeTruthy();
    expect(screen.getByText("MIPS.LOAD.WORD")).toBeTruthy();
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

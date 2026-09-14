import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ToolchainProvider } from "../features/compiler/ToolchainProvider";
import { fakeToolchain } from "../test/fakeToolchain";
import { App, RouteView } from "./App";

const createToolchain = () => Promise.resolve(fakeToolchain());

afterEach(() => {
  window.location.hash = "";
});

describe("App", () => {
  it("renders the OSP home route by default", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1, name: "OSP" })).toBeTruthy();
    expect(screen.getByText("Original Source Procurement")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Mission map" })).toBeTruthy();
  });

  it("links to the third-party notices shipped with the build", () => {
    render(<App createToolchain={createToolchain} />);

    const link = screen.getByRole("link", { name: "Third-party notices" });
    expect(link.getAttribute("href")).toBe("./THIRD_PARTY_NOTICES.txt");
  });

  it("follows hash navigation", async () => {
    render(<App createToolchain={createToolchain} />);

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
  it("names the requested mission", () => {
    render(<RouteView route={{ kind: "mission", missionId: "001" }} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Mission" }),
    ).toBeTruthy();
    expect(screen.getByText("001")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Return to mission map" })
        .getAttribute("href"),
    ).toBe("#/");
  });

  it("names the requested manual entry", () => {
    render(<RouteView route={{ kind: "manual", entryId: "MIPS.LOAD.WORD" }} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Manual" }),
    ).toBeTruthy();
    expect(screen.getByText("MIPS.LOAD.WORD")).toBeTruthy();
  });

  it("renders settings with the toolchain panel and no detail line", async () => {
    const { container } = render(
      <ToolchainProvider createToolchain={createToolchain}>
        <RouteView route={{ kind: "settings" }} />
      </ToolchainProvider>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Settings" }),
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

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeToolchain } from "../test/fakeToolchain";
import { ToolchainProvider } from "../features/compiler/ToolchainProvider";
import {
  MissionCatalogContext,
  shippedCatalog,
} from "../features/curriculum/missionCatalog";
import { MissionRoute } from "./MissionRoute";

describe("MissionRoute", () => {
  it("opens a shipped mission's briefing by ID", () => {
    render(
      <ToolchainProvider
        createToolchain={() => Promise.resolve(fakeToolchain())}
      >
        <MissionRoute missionId="002" />
      </ToolchainProvider>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "ARGUMENT ZERO" }),
    ).toBeTruthy();
  });

  it("reports a mission ID the catalog does not have", () => {
    render(
      <MissionCatalogContext value={{ ...shippedCatalog, missions: [] }}>
        <MissionRoute missionId="001" />
      </MissionCatalogContext>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Mission not found" }),
    ).toBeTruthy();
    expect(screen.getByText("001")).toBeTruthy();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolchainProvider } from "../features/compiler/ToolchainProvider";
import {
  MissionCatalogContext,
  shippedCatalog,
} from "../features/curriculum/missionCatalog";
import { fakeToolchain } from "../test/fakeToolchain";
import { memoryProgress } from "../test/progressStorage";
import { MissionRoute } from "./MissionRoute";

describe("MissionRoute", () => {
  it("opens a shipped mission's briefing by ID", async () => {
    render(
      memoryProgress().wrap(
        <ToolchainProvider
          createToolchain={() => Promise.resolve(fakeToolchain())}
        >
          <MissionRoute missionId="002" />
        </ToolchainProvider>,
      ),
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "ARGUMENT ZERO" }),
    ).toBeTruthy();
  });

  it("reports a mission ID the catalog does not have", async () => {
    render(
      memoryProgress().wrap(
        <MissionCatalogContext value={{ ...shippedCatalog, missions: [] }}>
          <MissionRoute missionId="001" />
        </MissionCatalogContext>,
      ),
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Mission not found",
      }),
    ).toBeTruthy();
    expect(screen.getByText("001")).toBeTruthy();
  });
});

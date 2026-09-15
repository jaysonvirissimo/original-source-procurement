import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import VrCanvas from "./VrCanvas";

vi.mock("@react-three/fiber", () => ({
  Canvas: (props: {
    className: string;
    dpr: number;
    frameloop: string;
    gl: unknown;
    camera: unknown;
    children: ReactNode;
  }) => (
    <div
      data-testid="canvas"
      className={props.className}
      data-dpr={props.dpr}
      data-frameloop={props.frameloop}
      data-gl={JSON.stringify(props.gl)}
      data-camera={JSON.stringify(props.camera)}
    >
      {props.children}
    </div>
  ),
}));

vi.mock("./scene/VrChamber", () => ({
  VrChamber: (props: { state: { phase: string } }) => (
    <p data-testid="chamber">{props.state.phase}</p>
  ),
}));

const colors = {
  void: "a",
  grid: "b",
  gridDim: "c",
  line: "d",
  info: "e",
  match: "f",
  error: "g",
};

describe("VrCanvas", () => {
  it("renders the chamber at the given resolution and frame loop, without antialiasing", () => {
    render(
      <VrCanvas
        state={{
          phase: "exact",
          missionTier: "training",
          reducedMotion: true,
          quality: "full",
        }}
        colors={colors}
        frameloop="demand"
        dpr={1.5}
      />,
    );

    const canvas = screen.getByTestId("canvas");
    expect(canvas.dataset.dpr).toBe("1.5");
    expect(canvas.dataset.frameloop).toBe("demand");
    expect(JSON.parse(canvas.dataset.gl ?? "")).toEqual({
      antialias: false,
      powerPreference: "low-power",
    });
    expect(JSON.parse(canvas.dataset.camera ?? "")).toMatchObject({
      position: [0, 1.6, 10],
    });
    expect(canvas.className).not.toBe("");
    expect(screen.getByTestId("chamber").textContent).toBe("exact");
  });
});

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { samplePlayer } from "../features/persistence/persistence.test-helpers";
import type { Settings } from "../features/persistence/schema";
import { memoryProgress } from "../test/progressStorage";
import { usePublishPresentation } from "./presentationContext";
import { PresentationLayer } from "./PresentationLayer";
import { PresentationProvider } from "./PresentationProvider";
import type { VrCanvasProps } from "./VrCanvas";

const canvas = vi.hoisted(() => ({ fail: false }));

vi.mock("./VrCanvas", () => ({
  default: (props: VrCanvasProps) => {
    if (canvas.fail) {
      throw new Error("renderer failed");
    }
    return (
      <p data-testid="canvas">
        {`${props.state.phase} ${props.state.missionTier} ${props.frameloop} ${String(props.dpr)} ${props.colors.grid}`}
      </p>
    );
  },
}));

const TOKENS = [
  "--osp-void",
  "--osp-grid",
  "--osp-grid-dim",
  "--osp-line",
  "--osp-info",
  "--osp-match",
  "--osp-error",
];

function Publisher() {
  usePublishPresentation("compiling", "field");
  return null;
}

async function renderLayer(
  settings: Settings,
  options: { webgl?: boolean; publish?: boolean } = {},
) {
  const canUseWebgl = vi.fn(() => options.webgl ?? true);
  const progress = memoryProgress({ ...samplePlayer(), settings });
  const view = render(
    <PresentationProvider>
      {progress.wrap(
        <>
          <p>Loaded.</p>
          <PresentationLayer canUseWebgl={canUseWebgl} />
          {options.publish === true ? <Publisher /> : null}
        </>,
      )}
    </PresentationProvider>,
  );
  await screen.findByText("Loaded.");
  return { view, canUseWebgl };
}

function layer(): HTMLElement | null {
  return document.querySelector("[data-vr-layer]");
}

describe("PresentationLayer", () => {
  beforeEach(() => {
    TOKENS.forEach((token, index) => {
      document.documentElement.style.setProperty(
        token,
        `#00000${String(index)}`,
      );
    });
    vi.stubGlobal("devicePixelRatio", 2);
  });

  afterEach(() => {
    document.documentElement.removeAttribute("style");
    vi.unstubAllGlobals();
    canvas.fail = false;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });

  it("draws the chamber behind the page, hidden from assistive technology", async () => {
    await renderLayer({}, { publish: true });

    expect((await screen.findByTestId("canvas")).textContent).toBe(
      "compiling field always 1.5 #000001",
    );
    const host = layer();
    expect(host?.getAttribute("aria-hidden")).toBe("true");
    expect(host?.dataset.vrPhase).toBe("compiling");
    expect(host?.dataset.vrTier).toBe("field");
    expect(host?.dataset.vrMotion).toBe("full");
    expect(document.documentElement.dataset.motion).toBeUndefined();
  });

  it("never probes WebGL in simple graphics mode", async () => {
    const { canUseWebgl } = await renderLayer({ graphics: "simple" });

    expect(layer()).toBeNull();
    expect(canUseWebgl).not.toHaveBeenCalled();
  });

  it("draws nothing without WebGL or without the design tokens", async () => {
    const { view } = await renderLayer({}, { webgl: false });
    expect(layer()).toBeNull();
    view.unmount();

    document.documentElement.removeAttribute("style");
    const { canUseWebgl } = await renderLayer({});
    expect(layer()).toBeNull();
    expect(canUseWebgl).not.toHaveBeenCalled();
  });

  it("renders on demand and marks the page when motion is reduced, until it unmounts", async () => {
    const { view } = await renderLayer({ motion: "reduced" });

    expect(layer()?.dataset.vrMotion).toBe("reduced");
    expect(layer()?.dataset.vrFrameloop).toBe("demand");
    expect(document.documentElement.dataset.motion).toBe("reduced");

    view.unmount();
    expect(document.documentElement.dataset.motion).toBeUndefined();
  });

  it("stops rendering while the page is hidden", async () => {
    await renderLayer({});
    expect(layer()?.dataset.vrFrameloop).toBe("always");

    act(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(layer()?.dataset.vrFrameloop).toBe("never");
  });

  it("removes the canvas when the renderer fails, keeping the page", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    canvas.fail = true;

    await renderLayer({});

    await waitFor(() => {
      expect(layer()).not.toBeNull();
    });
    expect(screen.queryByTestId("canvas")).toBeNull();
    expect(screen.getByText("Loaded.")).toBeTruthy();
  });
});

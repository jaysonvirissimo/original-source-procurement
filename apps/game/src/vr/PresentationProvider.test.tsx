import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MissionTier, VrPhase } from "./presentation";
import {
  usePrefersReducedMotion,
  usePublishPresentation,
  useWorkspacePresentation,
} from "./presentationContext";
import { PresentationProvider } from "./PresentationProvider";

function Reader() {
  const { phase, missionTier } = useWorkspacePresentation();
  return <p data-testid="read">{`${phase} ${missionTier}`}</p>;
}

function Publisher(props: { phase: VrPhase; tier: MissionTier }) {
  usePublishPresentation(props.phase, props.tier);
  return null;
}

function MotionProbe() {
  return <p data-testid="motion">{String(usePrefersReducedMotion())}</p>;
}

describe("PresentationProvider", () => {
  it("is idle training without a workspace, follows one, and resets when it closes", () => {
    const view = render(
      <PresentationProvider>
        <Reader />
      </PresentationProvider>,
    );
    expect(screen.getByTestId("read").textContent).toBe("idle training");

    view.rerender(
      <PresentationProvider>
        <Reader />
        <Publisher phase="compiling" tier="field" />
      </PresentationProvider>,
    );
    expect(screen.getByTestId("read").textContent).toBe("compiling field");

    view.rerender(
      <PresentationProvider>
        <Reader />
        <Publisher phase="exact" tier="field" />
      </PresentationProvider>,
    );
    expect(screen.getByTestId("read").textContent).toBe("exact field");

    view.rerender(
      <PresentationProvider>
        <Reader />
      </PresentationProvider>,
    );
    expect(screen.getByTestId("read").textContent).toBe("idle training");
  });

  it("ignores publishing outside a provider", () => {
    render(<Publisher phase="error" tier="live" />);
    render(<Reader />);
    expect(screen.getByTestId("read").textContent).toBe("idle training");
  });
});

describe("usePrefersReducedMotion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is false when the browser cannot answer", () => {
    vi.stubGlobal("matchMedia", undefined);
    render(<MotionProbe />);
    expect(screen.getByTestId("motion").textContent).toBe("false");
  });

  it("follows the reduced-motion media query as it changes", () => {
    let matches = true;
    const listeners = new Set<() => void>();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        media: query,
        get matches() {
          return matches;
        },
        addEventListener: (_type: string, listener: () => void) => {
          listeners.add(listener);
        },
        removeEventListener: (_type: string, listener: () => void) => {
          listeners.delete(listener);
        },
      })),
    );

    const view = render(<MotionProbe />);
    expect(screen.getByTestId("motion").textContent).toBe("true");

    act(() => {
      matches = false;
      listeners.forEach((listener) => {
        listener();
      });
    });
    expect(screen.getByTestId("motion").textContent).toBe("false");

    view.unmount();
    expect(listeners.size).toBe(0);
  });
});

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SOURCE_SAVE_DELAY_MS, useSourceAutosave } from "./useSourceAutosave";

interface Props {
  readonly source: string | undefined;
  readonly save: (source: string) => void;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(document, "visibilityState");
});

function renderAutosave(source: string | undefined, save = vi.fn()) {
  const hook = renderHook(
    (props: Props) => {
      useSourceAutosave(props.source, props.save);
    },
    { initialProps: { source, save } },
  );
  return { ...hook, save };
}

describe("useSourceAutosave", () => {
  it("saves once the source stops changing, and not the source it started with", () => {
    const { rerender, save } = renderAutosave("a");

    act(() => {
      vi.advanceTimersByTime(SOURCE_SAVE_DELAY_MS);
    });
    expect(save).not.toHaveBeenCalled();

    rerender({ source: "ab", save });
    act(() => {
      vi.advanceTimersByTime(SOURCE_SAVE_DELAY_MS - 1);
    });
    rerender({ source: "abc", save });
    act(() => {
      vi.advanceTimersByTime(SOURCE_SAVE_DELAY_MS - 1);
    });
    expect(save).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(save).toHaveBeenCalledExactlyOnceWith("abc");
  });

  it("waits while the source is undefined", () => {
    const { rerender, save } = renderAutosave(undefined);

    act(() => {
      vi.advanceTimersByTime(SOURCE_SAVE_DELAY_MS * 2);
    });
    expect(save).not.toHaveBeenCalled();

    rerender({ source: "entered", save });
    act(() => {
      vi.advanceTimersByTime(SOURCE_SAVE_DELAY_MS);
    });
    expect(save).toHaveBeenCalledExactlyOnceWith("entered");
  });

  it("saves at once when the page is hidden or left", () => {
    const { rerender, save } = renderAutosave("a");

    rerender({ source: "b", save });
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(save).toHaveBeenCalledExactlyOnceWith("b");
    act(() => {
      vi.advanceTimersByTime(SOURCE_SAVE_DELAY_MS);
    });
    expect(save).toHaveBeenCalledTimes(1);

    rerender({ source: "c", save });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(save).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(save).toHaveBeenLastCalledWith("c");
  });

  it("saves pending source on unmount with the latest save function", () => {
    const { rerender, unmount, save } = renderAutosave("a");
    const replacement = vi.fn();

    rerender({ source: "typed", save: replacement });
    unmount();

    expect(save).not.toHaveBeenCalled();
    expect(replacement).toHaveBeenCalledExactlyOnceWith("typed");
    window.dispatchEvent(new Event("pagehide"));
    expect(replacement).toHaveBeenCalledTimes(1);
  });
});

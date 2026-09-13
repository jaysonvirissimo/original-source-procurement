import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHashRoute } from "./useHashRoute";

afterEach(() => {
  window.location.hash = "";
  vi.restoreAllMocks();
});

function navigate(hash: string): void {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

describe("useHashRoute", () => {
  it("reads the current hash", () => {
    window.location.hash = "#/settings";

    const { result } = renderHook(() => useHashRoute());

    expect(result.current).toEqual({ kind: "settings" });
  });

  it("updates when the hash changes", () => {
    const { result } = renderHook(() => useHashRoute());
    expect(result.current).toEqual({ kind: "home" });

    navigate("#/mission/001");

    expect(result.current).toEqual({ kind: "mission", missionId: "001" });
  });

  it("stops listening for hash changes after unmount", () => {
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useHashRoute());

    unmount();

    expect(removeListener).toHaveBeenCalledWith(
      "hashchange",
      expect.any(Function),
    );
  });
});

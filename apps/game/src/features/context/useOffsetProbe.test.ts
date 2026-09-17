import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fakeToolchain } from "../../test/fakeToolchain";
import type { CompilationInput, ToolchainService } from "../compiler/types";
import { probeBuild } from "./probe.test-helpers";
import { useOffsetProbe } from "./useOffsetProbe";

// OSP-authored declarations.
const STARTER = "struct Pair { short a; short b; };\n";
const input: CompilationInput = {
  filename: "f.c",
  source: "",
  headers: {},
  cppFlags: [],
  rawFlags: [],
  gpSize: 0,
  aspsxVersion: "2.77",
  encoding: "utf8",
};
const TYPES = ["struct Pair"];
const MEASURED = {
  kind: "measured",
  types: [
    {
      kind: "measured",
      name: "struct Pair",
      size: 4,
      fields: [
        { name: "a", typeText: "short", kind: "scalar", offset: 0, size: 2 },
        { name: "b", typeText: "short", kind: "scalar", offset: 2, size: 2 },
      ],
    },
  ],
};

function service(build = probeBuild(STARTER, STARTER, [4, 0, 2, 2, 2])) {
  return { ...fakeToolchain(), build } satisfies ToolchainService;
}

interface Props {
  service: ToolchainService | undefined;
  input: CompilationInput | undefined;
  typeNames: readonly string[] | undefined;
  paused: boolean;
}

function render(props: Props) {
  return renderHook(
    (current: Props) => useOffsetProbe({ ...current, starterSource: STARTER }),
    { initialProps: props },
  );
}

describe("useOffsetProbe", () => {
  it("offers no table when the mission names no types", () => {
    const toolchain = service();
    const { result } = render({
      service: toolchain,
      input,
      typeNames: undefined,
      paused: false,
    });
    expect(result.current.state).toBeUndefined();
    expect(toolchain.build).not.toHaveBeenCalled();
  });

  it("waits for the toolchain and the input, then measures once", async () => {
    const toolchain = service();
    const { result, rerender } = render({
      service: undefined,
      input: undefined,
      typeNames: TYPES,
      paused: false,
    });
    expect(result.current.state).toEqual({ kind: "measuring" });

    rerender({ service: toolchain, input, typeNames: TYPES, paused: false });
    await waitFor(() => {
      expect(result.current.state).toEqual(MEASURED);
    });
    rerender({ service: toolchain, input, typeNames: TYPES, paused: false });
    expect(toolchain.build).toHaveBeenCalledTimes(2);

    const next = { ...input };
    rerender({
      service: toolchain,
      input: next,
      typeNames: TYPES,
      paused: false,
    });
    expect(result.current.state).toEqual({ kind: "measuring" });
    await waitFor(() => {
      expect(result.current.state).toEqual(MEASURED);
    });
    expect(toolchain.build).toHaveBeenCalledTimes(4);
  });

  it("stops for the player's build and starts again after it", () => {
    const signals: AbortSignal[] = [];
    const build = vi.fn<ToolchainService["build"]>((_input, signal) => {
      if (signal !== undefined) {
        signals.push(signal);
      }
      return new Promise(() => undefined);
    });
    const toolchain = service(build);
    const { result, rerender, unmount } = render({
      service: toolchain,
      input,
      typeNames: TYPES,
      paused: false,
    });
    expect(signals).toHaveLength(1);

    act(() => {
      result.current.cancel();
    });
    expect(signals[0]?.aborted).toBe(true);
    // Restarted at once; the worker queues it behind the player's build.
    expect(signals).toHaveLength(2);

    rerender({ service: toolchain, input, typeNames: TYPES, paused: true });
    expect(signals[1]?.aborted).toBe(true);
    expect(signals).toHaveLength(2);
    rerender({ service: toolchain, input, typeNames: TYPES, paused: false });
    expect(signals).toHaveLength(3);
    expect(result.current.state).toEqual({ kind: "measuring" });

    unmount();
    expect(signals[2]?.aborted).toBe(true);
  });

  it("ignores a cancelled probe that finishes", async () => {
    const toolchain = service(
      vi.fn<ToolchainService["build"]>(() =>
        Promise.resolve({ kind: "cancelled" }),
      ),
    );
    const { result } = render({
      service: toolchain,
      input,
      typeNames: TYPES,
      paused: false,
    });
    await waitFor(() => {
      expect(toolchain.build).toHaveBeenCalledOnce();
    });
    await act(() => Promise.resolve());
    expect(result.current.state).toEqual({ kind: "measuring" });
  });
});

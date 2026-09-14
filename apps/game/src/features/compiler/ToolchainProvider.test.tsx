import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { deferred, fakeToolchain } from "../../test/fakeToolchain";
import { useToolchain } from "./toolchainContext";
import { ToolchainProvider } from "./ToolchainProvider";
import type { ToolchainService } from "./types";

function Probe(): ReactElement {
  const { state, start } = useToolchain();
  return (
    <div>
      <p>
        {state.status === "failed" ? `failed: ${state.message}` : state.status}
      </p>
      <button type="button" onClick={start}>
        Start
      </button>
    </div>
  );
}

function renderProvider(createToolchain: () => Promise<ToolchainService>) {
  return render(
    <ToolchainProvider createToolchain={createToolchain}>
      <Probe />
    </ToolchainProvider>,
  );
}

const clickStart = () => {
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
};

describe("ToolchainProvider", () => {
  it("starts nothing until asked, then creates the service once", async () => {
    const service = fakeToolchain();
    const pending = deferred<ToolchainService>();
    const createToolchain = vi.fn(() => pending.promise);
    renderProvider(createToolchain);

    expect(screen.getByText("idle")).toBeTruthy();
    clickStart();
    clickStart();
    expect(screen.getByText("starting")).toBeTruthy();

    await act(async () => {
      pending.resolve(service);
      await pending.promise;
    });
    expect(screen.getByText("ready")).toBeTruthy();

    clickStart();
    expect(createToolchain).toHaveBeenCalledTimes(1);
  });

  it("retries after a failed start", async () => {
    const createToolchain = vi
      .fn<() => Promise<ToolchainService>>()
      .mockRejectedValueOnce(new Error("The worker did not start."))
      .mockResolvedValueOnce(fakeToolchain());
    renderProvider(createToolchain);

    clickStart();
    expect(
      await screen.findByText("failed: The worker did not start."),
    ).toBeTruthy();

    clickStart();
    expect(await screen.findByText("ready")).toBeTruthy();
    expect(createToolchain).toHaveBeenCalledTimes(2);
  });

  it("describes a failure that is not an error", async () => {
    renderProvider(() =>
      Promise.reject(new Error("unused")).catch(() => {
        throw "not an error" as unknown as Error;
      }),
    );

    clickStart();

    expect(
      await screen.findByText("failed: The compiler did not start."),
    ).toBeTruthy();
  });

  it("disposes the service when it unmounts", async () => {
    const service = fakeToolchain();
    const { unmount } = renderProvider(() => Promise.resolve(service));

    clickStart();
    await screen.findByText("ready");
    unmount();

    expect(service.dispose).toHaveBeenCalledTimes(1);
  });

  it("disposes a service that finishes starting after unmount", async () => {
    const service = fakeToolchain();
    const pending = deferred<ToolchainService>();
    const { unmount } = renderProvider(() => pending.promise);

    clickStart();
    unmount();
    await act(async () => {
      pending.resolve(service);
      await pending.promise;
    });

    expect(service.dispose).toHaveBeenCalledTimes(1);
  });

  it("ignores a failed start that settles after unmount", async () => {
    const pending = deferred<ToolchainService>();
    const { unmount } = renderProvider(() => pending.promise);

    clickStart();
    unmount();

    await act(async () => {
      pending.reject(new Error("late"));
      await pending.promise.catch(() => undefined);
    });
  });
});

describe("useToolchain", () => {
  it("fails outside a provider", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    expect(() => render(<Probe />)).toThrow(
      "useToolchain must be used inside a ToolchainProvider.",
    );
    consoleError.mockRestore();
  });
});

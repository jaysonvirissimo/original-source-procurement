import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  assembledObject,
  fakeToolchain,
  type FakeToolchain,
} from "../../test/fakeToolchain";
import { ToolchainProvider } from "../compiler/ToolchainProvider";
import type { ToolchainService } from "../compiler/types";
import { CHECK_SOURCE, checkInput } from "./toolchainCheck";
import { ToolchainPanel } from "./ToolchainPanel";

function renderPanel(
  createToolchain: () => Promise<ToolchainService>,
): ReturnType<typeof render> {
  return render(
    <ToolchainProvider createToolchain={createToolchain}>
      <ToolchainPanel />
    </ToolchainProvider>,
  );
}

async function renderReady(service: FakeToolchain) {
  const view = renderPanel(() => Promise.resolve(service));
  await screen.findByText("compiler-build");
  return view;
}

const runCheck = () => {
  fireEvent.click(screen.getByRole("button", { name: "Run check" }));
};

describe("ToolchainPanel", () => {
  it("starts the toolchain and shows its versions", async () => {
    renderPanel(() => Promise.resolve(fakeToolchain()));

    expect(screen.getByText("Starting the compiler.")).toBeTruthy();
    expect(await screen.findByText("compiler-build")).toBeTruthy();
    expect(screen.getByText("preprocessor-build")).toBeTruthy();
    expect(screen.getByText("psyq-asm 0.2.0")).toBeTruthy();
  });

  it("compiles the check source and lists the assembled words", async () => {
    const service = fakeToolchain({
      kind: "success",
      object: assembledObject([0x03e00008, 0x24820005]),
      compilerText: "",
      diagnostics: [],
    });
    await renderReady(service);

    runCheck();

    expect(
      await screen.findByText("Compiled and assembled 2 words."),
    ).toBeTruthy();
    expect(service.build).toHaveBeenCalledWith(
      checkInput(CHECK_SOURCE),
      expect.any(AbortSignal),
    );
    expect(screen.getByLabelText("Assembled words").textContent).toBe(
      "0000  03e00008  jr $ra\n0004  24820005  addiu $v0,$a0,0x5",
    );
  });

  it("compiles edited source and lists compiler diagnostics", async () => {
    const service = fakeToolchain({
      kind: "compiler-failure",
      diagnostics: [
        { severity: "error", file: "check.c", line: 1, message: "parse error" },
      ],
    });
    await renderReady(service);

    fireEvent.change(screen.getByLabelText("Check source"), {
      target: { value: "int f(" },
    });
    runCheck();

    expect(
      await screen.findByText("The compiler reported errors."),
    ).toBeTruthy();
    expect(service.build).toHaveBeenCalledWith(
      checkInput("int f("),
      expect.any(AbortSignal),
    );
    expect(screen.getByRole("list", { name: "Diagnostics" }).textContent).toBe(
      "check.c:1: error: parse error",
    );
    expect(screen.queryByLabelText("Assembled words")).toBeNull();
  });

  it("cancels a running check", async () => {
    const service = fakeToolchain();
    service.build.mockImplementation(
      (_input, signal) =>
        new Promise((resolve) => {
          signal?.addEventListener("abort", () => {
            resolve({ kind: "cancelled" });
          });
        }),
    );
    await renderReady(service);
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveProperty("disabled", true);

    runCheck();

    expect(screen.getByText("Compiling.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Run check" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(cancel).toHaveProperty("disabled", false);
    fireEvent.click(cancel);
    expect(await screen.findByText("Check cancelled.")).toBeTruthy();
    expect(screen.queryByText("Compiling.")).toBeNull();
  });

  it("offers a retry when the compiler does not start", async () => {
    const createToolchain = vi
      .fn<() => Promise<ToolchainService>>()
      .mockRejectedValueOnce(new Error("The worker did not start."))
      .mockResolvedValueOnce(fakeToolchain());
    renderPanel(createToolchain);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "The compiler did not start: The worker did not start.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("compiler-build")).toBeTruthy();
  });

  it("aborts a running check when it unmounts", async () => {
    const service = fakeToolchain();
    let signal: AbortSignal | undefined;
    service.build.mockImplementation((_input, received) => {
      signal = received;
      return new Promise(() => undefined);
    });
    const { unmount } = await renderReady(service);

    runCheck();
    unmount();

    expect(signal?.aborted).toBe(true);
  });
});

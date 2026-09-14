import { forEachDiagnostic } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import type { Mission } from "@osp/mission-schema";
import {
  PLACEHOLDER_COMMIT,
  PLACEHOLDER_HASH,
  realMission,
} from "@osp/mission-schema/testing";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fakeToolchain } from "../../test/fakeToolchain";
import { ToolchainProvider } from "../compiler/ToolchainProvider";
import type { BuildOutcome, ToolchainService } from "../compiler/types";
import type { UpstreamService } from "../upstream/types";
import { offlineUpstream, UpstreamContext } from "../upstream/upstreamContext";
import {
  inlineWords,
  objectWith,
  shippedMission,
  successWith,
} from "./workspace.test-helpers";
import { Workspace } from "./Workspace";

const returnPath = shippedMission("001");
const argumentZero = shippedMission("002");
const addImmediate = shippedMission("003");

const exact003 = successWith(
  objectWith("add_immediate", inlineWords(addImmediate)),
);
// The target's return, with an OSP-authored addiu $v0,$a0,4 in its delay slot.
const mismatch003 = successWith(
  objectWith("add_immediate", [
    ...inlineWords(addImmediate).slice(0, 1),
    0x24820004,
  ]),
);

interface RenderOptions {
  readonly service?: ToolchainService;
  readonly createToolchain?: () => Promise<ToolchainService>;
  readonly upstream?: UpstreamService;
}

function renderWorkspace(mission: Mission, options: RenderOptions = {}) {
  const service = options.service ?? fakeToolchain();
  const workspace = <Workspace mission={mission} />;
  return render(
    <ToolchainProvider
      createToolchain={
        options.createToolchain ?? (() => Promise.resolve(service))
      }
    >
      {options.upstream === undefined ? (
        workspace
      ) : (
        <UpstreamContext value={options.upstream}>{workspace}</UpstreamContext>
      )}
    </ToolchainProvider>,
  );
}

function enter(): void {
  fireEvent.click(screen.getByRole("button", { name: "Enter" }));
}

function compileButton(): HTMLElement {
  return screen.getByRole("button", { name: /^Compil/ });
}

function button(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

function statusText(): string | null {
  return screen.getByRole("status").textContent;
}

async function whenEnabled(element: () => HTMLElement): Promise<void> {
  await waitFor(() => {
    expect(element()).toHaveProperty("disabled", false);
  });
}

async function compileWhenReady(): Promise<void> {
  await whenEnabled(compileButton);
  fireEvent.click(compileButton());
}

function editorView(): EditorView {
  const view = EditorView.findFromDOM(
    screen.getByRole("textbox", { name: "C source" }),
  );
  if (view === null) {
    throw new Error("The workspace has no editor.");
  }
  return view;
}

function replaceSource(source: string): void {
  act(() => {
    const view = editorView();
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: source },
    });
  });
}

describe("Workspace", () => {
  it("opens on the briefing, then shows the target before the first build", async () => {
    const service = fakeToolchain();
    renderWorkspace(addImmediate, { service });

    expect(
      screen.getByRole("heading", { level: 1, name: "ADD IMMEDIATE" }),
    ).toBeTruthy();
    expect(screen.getByText("Arguments")).toBeTruthy();
    enter();

    expect(screen.getByText("Starting the compiler.")).toBeTruthy();
    expect(
      screen.getByRole("table", { name: "Target instructions" }).textContent,
    ).toContain("addiu $v0,$a0,0x5");
    expect(statusText()).toBe("NOT COMPILED");
    expect(screen.getByText("ATTEMPT 00")).toBeTruthy();
    await whenEnabled(compileButton);
    expect(service.build).not.toHaveBeenCalled();
  });

  it("classifies a mismatch, marks it stale after an edit, and completes on an exact match", async () => {
    const service = fakeToolchain(mismatch003);
    renderWorkspace(addImmediate, { service });
    enter();

    await compileWhenReady();
    await waitFor(() => {
      expect(statusText()).toBe("NOT AN EXACT MATCH");
    });
    expect(service.build).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "add_immediate.c",
        source: addImmediate.starterSource,
      }),
      expect.any(AbortSignal),
    );
    expect(
      within(screen.getByRole("list", { name: "Mismatches" })).getAllByRole(
        "listitem",
      )[0]?.textContent,
    ).toMatch(/^Immediate/);
    expect(screen.getByText("ATTEMPT 01")).toBeTruthy();

    service.build.mockResolvedValue(exact003);
    replaceSource(addImmediate.solution ?? "");
    expect(statusText()).toBe("NOT AN EXACT MATCH · STALE");
    expect(screen.getByText(/^STALE/)).toBeTruthy();

    await compileWhenReady();
    expect(
      await screen.findByRole("heading", { name: "Mission complete" }),
    ).toBeTruthy();
    expect(service.build).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: addImmediate.solution }),
      expect.any(AbortSignal),
    );

    fireEvent.click(button("Return to workspace"));
    expect(statusText()).toBe("EXACT MATCH");
    expect(editorView().state.doc.toString()).toBe(addImmediate.solution);
  });

  it("does not complete from an exact result for source edited during the build", async () => {
    const service = fakeToolchain();
    let finish: (outcome: BuildOutcome) => void = () => undefined;
    service.build.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderWorkspace(addImmediate, { service });
    enter();

    await compileWhenReady();
    await waitFor(() => {
      expect(statusText()).toBe("COMPILING");
    });
    replaceSource("int add_immediate(int a) { return a + 5; }\n");
    await act(async () => {
      finish(exact003);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(statusText()).toBe("EXACT MATCH · STALE");
    });
    expect(
      screen.queryByRole("heading", { name: "Mission complete" }),
    ).toBeNull();

    service.build.mockResolvedValue(exact003);
    await compileWhenReady();
    expect(
      await screen.findByRole("heading", { name: "Mission complete" }),
    ).toBeTruthy();
  });

  it("names the expected and found functions when the mission's function is missing", async () => {
    const service = fakeToolchain(
      successWith(objectWith("add_five", inlineWords(addImmediate))),
    );
    renderWorkspace(addImmediate, { service });
    enter();

    await compileWhenReady();
    const feedback = await screen.findByRole("region", {
      name: "Build feedback",
    });
    expect(feedback.textContent).toContain("add_immediate");
    expect(feedback.textContent).toContain("add_five");
    expect(statusText()).toBe("FUNCTION MISSING");
    expect(
      screen.queryByRole("table", {
        name: "Target and generated instructions",
      }),
    ).toBeNull();

    service.build.mockResolvedValue(
      successWith(objectWith("add_immediate", [])),
    );
    replaceSource("");
    await compileWhenReady();
    expect(await screen.findByText("No functions were found.")).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Mission complete" }),
    ).toBeNull();
  });

  it("shows compiler errors in the workspace and marks them in the editor", async () => {
    const message = "parse error before `;'";
    const service = fakeToolchain({
      kind: "compiler-failure",
      diagnostics: [
        {
          severity: "error",
          file: "add_immediate.c",
          line: 3,
          column: 12,
          message,
        },
      ],
    });
    renderWorkspace(addImmediate, { service });
    enter();

    await compileWhenReady();
    expect(
      (await screen.findByRole("list", { name: "Diagnostics" })).textContent,
    ).toBe(`add_immediate.c:3:12: error: ${message}`);
    expect(statusText()).toBe("BUILD FAILED");
    const marks: string[] = [];
    forEachDiagnostic(editorView().state, (diagnostic) => {
      marks.push(diagnostic.message);
    });
    expect(marks).toEqual([message]);
    expect(
      screen.getByRole("table", { name: "Target instructions" }),
    ).toBeTruthy();
  });

  it("completes a demonstration after acknowledging the evidence of a current build", async () => {
    const service = fakeToolchain(
      successWith(objectWith("return_path", [0, 0])),
    );
    renderWorkspace(returnPath, { service });
    enter();
    const acknowledge = () => button("Acknowledge evidence");

    expect(acknowledge()).toHaveProperty("disabled", true);
    await compileWhenReady();
    await whenEnabled(acknowledge);
    replaceSource("int return_path(void) { return 7; }\n");
    expect(acknowledge()).toHaveProperty("disabled", true);

    await compileWhenReady();
    await whenEnabled(acknowledge);
    fireEvent.click(acknowledge());
    expect(
      await screen.findByRole("heading", { name: "Mission complete" }),
    ).toBeTruthy();
    expect(screen.getByText("NO")).toBeTruthy();
  });

  it("completes a prediction mission after a wrong prediction and a matched build", async () => {
    const service = fakeToolchain(successWith(objectWith("argument_zero", [])));
    renderWorkspace(argumentZero, { service });
    enter();

    expect(button("Record prediction")).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("radio", { name: "$v0" }));
    fireEvent.click(button("Record prediction"));
    expect(
      screen.getByText("Compile to check it against the assembled output."),
    ).toBeTruthy();

    await compileWhenReady();
    await waitFor(() => {
      expect(statusText()).toBe("FUNCTION MISSING");
    });
    service.build.mockResolvedValue(
      successWith(objectWith("argument_zero", inlineWords(argumentZero))),
    );
    await compileWhenReady();
    expect(
      await screen.findByRole("heading", { name: "Mission complete" }),
    ).toBeTruthy();

    fireEvent.click(button("Return to workspace"));
    expect(
      screen.getByRole("region", { name: "Prediction" }).textContent,
    ).toContain("Answer: $a0.");
  });

  it("reveals hints in order, highlights the target, and shows the solution read-only", () => {
    renderWorkspace(addImmediate);
    enter();

    fireEvent.click(button("Hint"));
    const hints = screen.getByRole("region", { name: "Hints" });
    expect(hints.textContent).toContain("Each hint gives away more");
    fireEvent.click(
      within(hints).getByRole("button", { name: "Reveal next hint" }),
    );
    fireEvent.click(
      within(hints).getByRole("button", { name: "Reveal next hint" }),
    );
    expect(
      document.querySelector('tr[data-highlighted="true"]')?.textContent,
    ).toContain("addiu $v0,$a0,0x5");
    fireEvent.click(
      within(hints).getByRole("button", { name: "Reveal next hint" }),
    );
    fireEvent.click(
      within(hints).getByRole("button", { name: "Reveal the solution" }),
    );

    expect(within(hints).getByLabelText("Solution").textContent).toBe(
      addImmediate.solution,
    );
    expect(
      within(hints)
        .getAllByRole("button")
        .map((element) => element.textContent),
    ).toEqual(["Close", "No more hints"]);

    fireEvent.keyDown(hints, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Hints" })).toBeNull();
    fireEvent.click(button("Hint"));
    fireEvent.click(button("Hint"));
    expect(screen.queryByRole("region", { name: "Hints" })).toBeNull();
    fireEvent.click(button("Hint"));
    fireEvent.click(
      within(screen.getByRole("region", { name: "Hints" })).getByRole(
        "button",
        { name: "Close" },
      ),
    );
    expect(screen.queryByRole("region", { name: "Hints" })).toBeNull();
  });

  it("opens the manual over the workspace without losing the source", () => {
    renderWorkspace(addImmediate);
    enter();
    const edited = "int add_immediate(int a) { return a + 1; }\n";
    replaceSource(edited);

    fireEvent.click(button("Manual"));
    const manual = screen.getByRole("region", { name: "Manual" });
    expect(
      within(manual).getByRole("heading", { name: "Add immediate" }),
    ).toBeTruthy();
    expect(
      within(manual).getByRole("heading", { name: "Arguments" }),
    ).toBeTruthy();
    fireEvent.click(button("Manual"));
    expect(screen.queryByRole("region", { name: "Manual" })).toBeNull();

    fireEvent.click(button("Manual"));
    fireEvent.click(
      within(screen.getByRole("region", { name: "Manual" })).getByRole(
        "button",
        { name: "Close" },
      ),
    );
    expect(screen.queryByRole("region", { name: "Manual" })).toBeNull();
    expect(editorView().state.doc.toString()).toBe(edited);
  });

  it("resizes the panels from the keyboard and by dragging", () => {
    renderWorkspace(addImmediate);
    enter();
    const handle = screen.getByRole("separator", {
      name: "Resize the editor and assembly panels",
    });
    const value = () => handle.getAttribute("aria-valuenow");

    expect(value()).toBe("50");
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(value()).toBe("55");
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(value()).toBe("45");
    fireEvent.keyDown(handle, { key: "Home" });
    expect(value()).toBe("25");
    fireEvent.keyDown(handle, { key: "End" });
    expect(value()).toBe("75");
    fireEvent.keyDown(handle, { key: "a" });
    expect(value()).toBe("75");

    const container = handle.parentElement;
    if (container === null) {
      throw new Error("The handle sits inside the split.");
    }
    const rect = vi
      .spyOn(container, "getBoundingClientRect")
      .mockReturnValue({ left: 100, width: 1000 } as unknown as DOMRect);
    fireEvent.pointerDown(handle, { clientX: 850 });
    fireEvent.pointerMove(window, { clientX: 500 });
    expect(value()).toBe("40");
    rect.mockReturnValue({ left: 0, width: 0 } as unknown as DOMRect);
    fireEvent.pointerMove(window, { clientX: 900 });
    expect(value()).toBe("40");
    fireEvent.pointerUp(window);
    rect.mockReturnValue({ left: 100, width: 1000 } as unknown as DOMRect);
    fireEvent.pointerMove(window, { clientX: 700 });
    expect(value()).toBe("40");
  });

  it("compiles with Mod-Enter from the editor or any workspace control", async () => {
    const service = fakeToolchain(mismatch003);
    renderWorkspace(addImmediate, { service });
    enter();
    const hint = button("Hint");

    fireEvent.keyDown(hint, { key: "Enter", ctrlKey: true });
    await whenEnabled(compileButton);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "C source" }), {
      key: "Enter",
      ctrlKey: true,
    });
    // Hashing and building are asynchronous; allow for a loaded test machine.
    await waitFor(
      () => {
        expect(service.build).toHaveBeenCalledTimes(1);
      },
      { timeout: 5000 },
    );
    await whenEnabled(compileButton);

    fireEvent.keyDown(hint, { key: "Escape" });
    fireEvent.keyDown(hint, { key: "Enter" });
    fireEvent.keyDown(hint, { key: "Enter", metaKey: true });
    await waitFor(
      () => {
        expect(service.build).toHaveBeenCalledTimes(2);
      },
      { timeout: 5000 },
    );
  });

  it("cancels a running build, and stops one when the workspace closes", async () => {
    const service = fakeToolchain();
    const signals: AbortSignal[] = [];
    service.build.mockImplementation(
      (_input, signal) =>
        new Promise((resolve) => {
          if (signal !== undefined) {
            signals.push(signal);
            signal.addEventListener("abort", () => {
              resolve({ kind: "cancelled" });
            });
          }
        }),
    );
    const { unmount } = renderWorkspace(addImmediate, { service });
    enter();

    await compileWhenReady();
    await whenEnabled(() => button("Cancel"));
    fireEvent.click(button("Cancel"));
    expect(await screen.findByText("Compile cancelled.")).toBeTruthy();

    await compileWhenReady();
    await waitFor(() => {
      expect(signals).toHaveLength(2);
    });
    unmount();
    expect(signals[1]?.aborted).toBe(true);
  });

  const withRemoteHeader: Mission = {
    ...addImmediate,
    compiler: {
      ...addImmediate.compiler,
      remoteHeaders: {
        "osp_context.h": {
          repository: "FoxdieTeam/mgs_reversing",
          commit: PLACEHOLDER_COMMIT,
          path: "source/osp_context.h",
          sha256: PLACEHOLDER_HASH,
        },
      },
    },
  };

  it.each([
    ["unavailable", "couldn't reach it"],
    ["content-mismatch", "didn't match what it expected"],
  ] as const)(
    "shows the %s state for mission context and retries",
    async (kind, copy) => {
      const loadC = vi
        .fn<UpstreamService["loadC"]>()
        .mockResolvedValueOnce({ kind, attempts: [] })
        .mockResolvedValue({
          kind: "loaded",
          value: "#define OSP_CONTEXT 1\n",
          source: "cache",
        });
      const service = fakeToolchain(mismatch003);
      renderWorkspace(withRemoteHeader, {
        service,
        upstream: { ...offlineUpstream, loadC },
      });
      enter();

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain(copy);
      expect(alert.textContent).toContain("osp_context.h");
      expect(compileButton()).toHaveProperty("disabled", true);

      fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
      await compileWhenReady();
      await waitFor(() => {
        expect(service.build).toHaveBeenCalledWith(
          expect.objectContaining({
            headers: { "osp_context.h": "#define OSP_CONTEXT 1\n" },
          }),
          expect.any(AbortSignal),
        );
      });
    },
  );

  it("says so while mission context is still loading", async () => {
    const loadC = vi.fn<UpstreamService["loadC"]>(
      () => new Promise(() => undefined),
    );
    renderWorkspace(withRemoteHeader, {
      upstream: { ...offlineUpstream, loadC },
    });
    enter();

    expect(await screen.findByText("Loading mission context.")).toBeTruthy();
    expect(compileButton()).toHaveProperty("disabled", true);
  });

  it("explains that a mission with a remote target cannot load in this build", () => {
    renderWorkspace(realMission());
    enter();

    expect(screen.getByRole("alert").textContent).toContain(
      "loads its target from upstream",
    );
    expect(compileButton()).toHaveProperty("disabled", true);
  });

  it("offers Retry when the compiler does not start", async () => {
    const service = fakeToolchain(exact003);
    const createToolchain = vi
      .fn<() => Promise<ToolchainService>>()
      .mockRejectedValueOnce(new Error("no WebAssembly"))
      .mockResolvedValue(service);
    renderWorkspace(addImmediate, { createToolchain });
    enter();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "The compiler did not start: no WebAssembly",
    );
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await compileWhenReady();
    expect(
      await screen.findByRole("heading", { name: "Mission complete" }),
    ).toBeTruthy();
  });
});

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
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { deferred, fakeToolchain } from "../../test/fakeToolchain";
import { memoryProgress } from "../../test/progressStorage";
import { AudioServiceContext } from "../audio/audioContext";
import { silentAudio, type AudioService } from "../audio/sounds";
import { ToolchainProvider } from "../compiler/ToolchainProvider";
import type { BuildOutcome, ToolchainService } from "../compiler/types";
import { saveDataError } from "../persistence/errors";
import {
  missionProgress,
  skillEvidence,
  timestamp,
} from "../persistence/persistence.test-helpers";
import { emptyPlayerState, type PlayerState } from "../persistence/schema";
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
  readonly player?: PlayerState;
  readonly audio?: AudioService;
}

/** Renders the workspace inside memory-backed progress, once it has loaded. */
async function renderWorkspace(mission: Mission, options: RenderOptions = {}) {
  const service = options.service ?? fakeToolchain();
  const progress = memoryProgress(options.player);
  const tree = (content: ReactElement) =>
    progress.wrap(
      <AudioServiceContext value={options.audio ?? silentAudio}>
        <ToolchainProvider
          createToolchain={
            options.createToolchain ?? (() => Promise.resolve(service))
          }
        >
          {options.upstream === undefined ? (
            content
          ) : (
            <UpstreamContext value={options.upstream}>
              {content}
            </UpstreamContext>
          )}
        </ToolchainProvider>
      </AudioServiceContext>,
    );
  const workspace = (key: string) => (
    <Workspace
      key={key}
      mission={mission}
      saved={progress.backing.player.missions[mission.id]}
    />
  );
  const view = render(tree(workspace("first")));
  await screen.findByRole("button", { name: "Enter" });
  return {
    ...view,
    progress,
    /** Removes the workspace and keeps progress mounted, as leaving a mission does. */
    close: () => {
      view.rerender(tree(<p>Closed</p>));
    },
    reopen: async () => {
      view.rerender(tree(workspace("again")));
      await screen.findByRole("button", { name: "Enter" });
    },
  };
}

function enter(): void {
  fireEvent.click(screen.getByRole("button", { name: "Enter" }));
}

function compileButton(): HTMLElement {
  return screen.getByRole("button", { name: /^Compil/ });
}

function focused(): Element {
  const element = document.activeElement;
  if (element === null) {
    throw new Error("Nothing has focus.");
  }
  return element;
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
    await renderWorkspace(addImmediate, { service });

    expect(
      screen.getByRole("heading", { level: 1, name: "ADD IMMEDIATE" }),
    ).toBeTruthy();
    expect(screen.getByText("Arguments · New")).toBeTruthy();
    enter();

    expect(screen.getByText("Starting the compiler.")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Mission map" }).getAttribute("href"),
    ).toBe("#/");
    expect(
      screen.getByRole("table", { name: "Target instructions" }).textContent,
    ).toContain("addiu $v0,$a0,0x5");
    expect(statusText()).toBe("NOT COMPILED");
    expect(screen.getByText("ATTEMPT 00")).toBeTruthy();
    await whenEnabled(compileButton);
    expect(service.build).not.toHaveBeenCalled();
  });

  it("plays cues for compiling, the build's result, and completion", async () => {
    const audio = { play: vi.fn() };
    await renderWorkspace(addImmediate, {
      service: fakeToolchain(exact003),
      audio,
    });
    enter();

    await compileWhenReady();
    await waitFor(() => {
      expect(audio.play).toHaveBeenCalledWith("mission-complete", 0.8);
    });
    expect(audio.play.mock.calls.map(([cue]) => cue as string)).toEqual([
      "compile",
      "exact-match",
      "mission-complete",
    ]);
  });

  it("classifies a mismatch, marks it stale after an edit, and completes on an exact match", async () => {
    const service = fakeToolchain(mismatch003);
    await renderWorkspace(addImmediate, { service });
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

    // Completion shows above the comparison and names what changed.
    expect(
      await screen.findByText("Add immediate: now Introduced"),
    ).toBeTruthy();
    expect(
      screen.getByRole("table", { name: "Target and generated instructions" }),
    ).toBeTruthy();

    fireEvent.click(button("Review workspace"));
    expect(
      screen.queryByRole("heading", { name: "Mission complete" }),
    ).toBeNull();
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
    await renderWorkspace(addImmediate, { service });
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
    await renderWorkspace(addImmediate, { service });
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
    await renderWorkspace(addImmediate, { service });
    enter();

    await compileWhenReady();
    const guidance =
      "The compiler did not expect ; on line 3. Check the statement before it, on line 2 or earlier; a missing semicolon is a common cause.";
    expect(
      (await screen.findByRole("list", { name: "Diagnostics" })).textContent,
    ).toBe(`add_immediate.c:3:12: error: ${message}${guidance}`);
    expect(statusText()).toBe("BUILD FAILED");
    // The editor receives its lint marks in an effect after the panel renders.
    await waitFor(() => {
      const marks: string[] = [];
      forEachDiagnostic(editorView().state, (diagnostic) => {
        marks.push(diagnostic.message);
      });
      expect(marks).toEqual([`${message}\n${guidance}`]);
    });
    expect(
      screen.getByRole("table", { name: "Target instructions" }),
    ).toBeTruthy();
  });

  it("completes a demonstration after acknowledging the evidence of a current build", async () => {
    const service = fakeToolchain(
      successWith(objectWith("return_path", [0, 0])),
    );
    await renderWorkspace(returnPath, { service });
    enter();
    const acknowledge = () => button("Acknowledge evidence");
    const word = (index: number) =>
      screen.getByRole("radio", {
        name: new RegExp(`^Word ${String(index)} ·`),
      });

    expect(acknowledge()).toHaveProperty("disabled", true);
    fireEvent.click(word(0));
    expect(acknowledge()).toHaveProperty("disabled", true);
    await compileWhenReady();
    await whenEnabled(acknowledge);
    replaceSource("int return_path(void) { return 7; }\n");
    expect(acknowledge()).toHaveProperty("disabled", true);

    await compileWhenReady();
    await whenEnabled(acknowledge);
    // A selection outside the evidence only points again.
    fireEvent.click(acknowledge());
    expect(
      within(screen.getByRole("group", { name: "EVIDENCE" })).getByRole(
        "status",
      ).textContent,
    ).toBe(returnPath.evidence?.retry);
    expect(
      screen.queryByRole("heading", { name: "Mission complete" }),
    ).toBeNull();

    fireEvent.click(word(1));
    fireEvent.click(acknowledge());
    expect(
      await screen.findByRole("heading", { name: "Mission complete" }),
    ).toBeTruthy();
    // The workspace's match summary stays visible beside the completion panel.
    expect(
      within(
        screen.getByRole("region", { name: "Mission complete" }),
      ).getByText("NO"),
    ).toBeTruthy();
  });

  it("completes a prediction mission after a wrong prediction is corrected, recording the first prediction", async () => {
    const service = fakeToolchain(successWith(objectWith("argument_zero", [])));
    const { progress } = await renderWorkspace(argumentZero, { service });
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
    const check = () => button("Check answer");
    fireEvent.click(await screen.findByRole("radio", { name: "$ra" }));
    await whenEnabled(check);
    expect(
      screen.queryByRole("heading", { name: "Mission complete" }),
    ).toBeNull();
    fireEvent.click(check());
    expect(
      within(screen.getByRole("region", { name: "Prediction" })).getByRole(
        "status",
      ).textContent,
    ).toBe("Not $ra. Read the output again.");

    fireEvent.click(screen.getByRole("radio", { name: "$a0" }));
    fireEvent.click(check());
    expect(
      await screen.findByRole("heading", { name: "Mission complete" }),
    ).toBeTruthy();
    await waitFor(() => {
      expect(progress.backing.player.missions["002"]?.predictions).toEqual([
        expect.objectContaining({
          choice: argumentZero.prediction?.choices.indexOf("$v0"),
          correct: false,
        }),
      ]);
    });

    // The correction shows alongside completion, before the player moves on.
    expect(screen.getByText("PREDICTION").nextElementSibling?.textContent).toBe(
      "First choice $v0; corrected to $a0.",
    );
    expect(
      screen.getByRole("region", { name: "Prediction" }).textContent,
    ).toContain("You found the answer in the output.");

    fireEvent.click(button("Review workspace"));
    expect(
      screen.getByRole("region", { name: "Prediction" }).textContent,
    ).toContain("Answer: $a0.");
  });

  it("reveals hints in order, highlights the target, and shows the solution read-only", async () => {
    await renderWorkspace(addImmediate);
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

  it("opens the manual beside the workspace without losing the source", async () => {
    await renderWorkspace(addImmediate);
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

  it("resizes the panels from the keyboard and by dragging", async () => {
    await renderWorkspace(addImmediate);
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

  it("docks a help panel beside the listing and returns focus to its control", async () => {
    await renderWorkspace(addImmediate);
    enter();
    const assembly = screen.getByRole("region", { name: "Assembly" });
    const split = assembly.parentElement;
    expect(split?.style.gridTemplateColumns).not.toContain("px");

    fireEvent.click(button("Scan"));
    fireEvent.click(
      within(screen.getByRole("region", { name: "Scan" })).getByRole("button", {
        name: "Close",
      }),
    );
    expect(screen.queryByRole("region", { name: "Scan" })).toBeNull();
    expect(document.activeElement).toBe(button("Scan"));

    fireEvent.click(button("Hint"));
    const hints = screen.getByRole("region", { name: "Hints" });
    expect(hints.parentElement?.parentElement).toBe(split);
    expect(split?.style.gridTemplateColumns).toContain("min(420px, 45%)");
    expect(screen.getByRole("textbox", { name: "C source" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Assembly" })).toBe(assembly);
    expect(document.activeElement).toBe(
      within(hints).getByRole("heading", { name: "Hints" }),
    );

    fireEvent.click(button("Manual"));
    const manual = screen.getByRole("region", { name: "Manual" });
    expect(document.activeElement).toBe(
      within(manual).getByRole("heading", { name: "Manual", level: 2 }),
    );
    fireEvent.keyDown(focused(), { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Manual" })).toBeNull();
    expect(document.activeElement).toBe(button("Manual"));
    expect(split?.style.gridTemplateColumns).not.toContain("px");
  });

  it("closes the hints with Escape after the last hint is revealed", async () => {
    await renderWorkspace(addImmediate);
    enter();
    fireEvent.click(button("Hint"));
    const hints = screen.getByRole("region", { name: "Hints" });
    for (;;) {
      const reveal = within(hints).queryByRole("button", {
        name: /^Reveal/,
      });
      if (reveal === null) {
        break;
      }
      reveal.focus();
      fireEvent.click(reveal);
      expect(hints.contains(document.activeElement)).toBe(true);
    }
    expect(document.activeElement?.textContent).toContain("Stage 9");

    fireEvent.keyDown(focused(), { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Hints" })).toBeNull();
    expect(document.activeElement).toBe(button("Hint"));
  });

  it("resizes the reference pane and saves its width", async () => {
    const { progress } = await renderWorkspace(addImmediate, {
      player: { ...emptyPlayerState(), settings: { referencePaneWidth: 500 } },
    });
    enter();
    fireEvent.click(button("Scan"));
    const handle = screen.getByRole("separator", {
      name: "Resize the reference pane",
    });
    const value = () => handle.getAttribute("aria-valuenow");
    const saved = () => progress.backing.player.settings.referencePaneWidth;

    expect(value()).toBe("500");
    expect(handle.getAttribute("aria-valuemin")).toBe("300");
    expect(handle.getAttribute("aria-valuemax")).toBe("640");
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(value()).toBe("540");
    await waitFor(() => {
      expect(saved()).toBe(540);
    });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(value()).toBe("460");
    fireEvent.keyDown(handle, { key: "End" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(value()).toBe("640");
    fireEvent.keyDown(handle, { key: "Home" });
    expect(value()).toBe("300");
    await waitFor(() => {
      expect(saved()).toBe(300);
    });

    const container = handle.parentElement;
    if (container === null) {
      throw new Error("The handle sits inside the split.");
    }
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
      left: 100,
      right: 1300,
      width: 1200,
    } as unknown as DOMRect);
    fireEvent.pointerDown(handle, { clientX: 1000 });
    fireEvent.pointerUp(window);
    fireEvent.pointerDown(handle, { clientX: 1000 });
    fireEvent.pointerMove(window, { clientX: 900 });
    expect(value()).toBe("400");
    expect(saved()).toBe(300);
    fireEvent.pointerUp(window);
    await waitFor(() => {
      expect(saved()).toBe(400);
    });

    fireEvent.click(button("Scan"));
    fireEvent.click(button("History"));
    expect(
      screen
        .getByRole("separator", { name: "Resize the reference pane" })
        .getAttribute("aria-valuenow"),
    ).toBe("400");
  });

  it("compiles with Mod-Enter from the editor or any workspace control", async () => {
    const service = fakeToolchain(mismatch003);
    await renderWorkspace(addImmediate, { service });
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
    const { unmount } = await renderWorkspace(addImmediate, { service });
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
      await renderWorkspace(withRemoteHeader, {
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
    await renderWorkspace(withRemoteHeader, {
      upstream: { ...offlineUpstream, loadC },
    });
    enter();

    expect(await screen.findByText("Loading mission context.")).toBeTruthy();
    expect(compileButton()).toHaveProperty("disabled", true);
  });

  describe("with an upstream target", () => {
    const mission = realMission();
    const words = [0x03e00008, 0x00000000];
    const header = { kind: "loaded", value: "\n", source: "cache" } as const;
    const remotePath =
      mission.target.kind === "remote" ? mission.target.path : "";

    it("lists the loaded target and compiles with its context", async () => {
      const loadTarget = vi
        .fn<UpstreamService["loadTarget"]>()
        .mockResolvedValue({ kind: "loaded", value: words, source: "cache" });
      const loadC = vi.fn<UpstreamService["loadC"]>().mockResolvedValue(header);
      const service = fakeToolchain(exact003);
      await renderWorkspace(mission, {
        service,
        upstream: { ...offlineUpstream, loadTarget, loadC },
      });
      enter();

      const listing = await screen.findByRole("table", {
        name: "Target instructions",
      });
      expect(within(listing).getAllByRole("row")).toHaveLength(
        words.length + 1,
      );
      expect(loadTarget).toHaveBeenCalledWith(
        mission.target,
        expect.any(AbortSignal),
      );
      await compileWhenReady();
      await waitFor(() => {
        expect(service.build).toHaveBeenCalledWith(
          expect.objectContaining({
            headers: { "psyq/include/sample.h": "\n" },
          }),
          expect.any(AbortSignal),
        );
      });
    });

    it.each([
      ["unavailable", "couldn't reach it"],
      ["content-mismatch", "didn't match what it expected"],
    ] as const)(
      "shows the %s state for the target and retries",
      async (kind, copy) => {
        const loadTarget = vi
          .fn<UpstreamService["loadTarget"]>()
          .mockResolvedValueOnce({ kind, attempts: [] })
          .mockResolvedValue({ kind: "loaded", value: words, source: "cache" });
        const loadC = vi
          .fn<UpstreamService["loadC"]>()
          .mockResolvedValue(header);
        await renderWorkspace(mission, {
          upstream: { ...offlineUpstream, loadTarget, loadC },
        });
        enter();

        const alert = await screen.findByRole("alert");
        expect(alert.textContent).toContain(copy);
        expect(alert.textContent).toContain(remotePath);
        expect(compileButton()).toHaveProperty("disabled", true);

        fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
        expect(
          await screen.findByRole("table", { name: "Target instructions" }),
        ).toBeTruthy();
      },
    );

    it("reports a failed header once the target has loaded", async () => {
      const loadTarget = vi
        .fn<UpstreamService["loadTarget"]>()
        .mockResolvedValue({ kind: "loaded", value: words, source: "cache" });
      await renderWorkspace(mission, {
        upstream: { ...offlineUpstream, loadTarget },
      });
      enter();

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain("psyq/include/sample.h");
    });

    it("says so while the target is loading", async () => {
      const loadTarget = vi.fn<UpstreamService["loadTarget"]>(
        () => new Promise(() => undefined),
      );
      await renderWorkspace(mission, {
        upstream: { ...offlineUpstream, loadTarget },
      });
      enter();

      expect(
        await screen.findByText("Loading the target from upstream."),
      ).toBeTruthy();
      expect(compileButton()).toHaveProperty("disabled", true);
    });
  });

  it("offers Retry when the compiler does not start", async () => {
    const service = fakeToolchain(exact003);
    const createToolchain = vi
      .fn<() => Promise<ToolchainService>>()
      .mockRejectedValueOnce(new Error("no WebAssembly"))
      .mockResolvedValue(service);
    await renderWorkspace(addImmediate, { createToolchain });
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

describe("Workspace teaching support", () => {
  const qualification = shippedMission("012");
  const loadWord: Mission = {
    ...shippedMission("006"),
    example: {
      caption: "p holds address 0x1000; memory there holds 42.",
      registers: [{ register: "$a0", value: 0x1000 }],
      regions: [
        {
          label: "int at p",
          address: 0x1000,
          cells: [{ offset: 0, size: 4, label: "*p", value: 42 }],
        },
      ],
    },
  };

  /** A skill introduced by one mission and practiced by another. */
  function practicedSkill(skill: string): PlayerState {
    return {
      ...emptyPlayerState(),
      skills: {
        [skill]: {
          evidence: [
            skillEvidence({ id: `c1:${skill}`, completionId: "c1", skill }),
            skillEvidence({
              id: `c2:${skill}`,
              completionId: "c2",
              skill,
              missionId: "900",
              kind: "practiced",
              completedAt: timestamp(1),
            }),
          ],
        },
      },
    };
  }

  /** 001's skill, practiced: introduced by 001, then practiced elsewhere. */
  function practicedReturn(
    settings: PlayerState["settings"] = {},
  ): PlayerState {
    return {
      ...emptyPlayerState(),
      skills: {
        "ABI.RETURN": {
          evidence: [
            skillEvidence(),
            skillEvidence({
              id: "completion-2:ABI.RETURN",
              completionId: "completion-2",
              missionId: "005",
              kind: "practiced",
              completedAt: timestamp(1),
            }),
          ],
        },
      },
      settings,
    };
  }

  /** The Note column, header included; a cell joins every label on its row. */
  function targetNotes(): (string | undefined)[] {
    return within(screen.getByRole("table", { name: "Target instructions" }))
      .getAllByRole("row")
      .map((row) => row.lastElementChild?.textContent);
  }

  function scanNotes(): string[] {
    fireEvent.click(button("Scan"));
    const scan = screen.getByRole("region", { name: "Scan" });
    return within(scan)
      .getAllByRole("listitem")
      .map((item) => item.textContent);
  }

  it("guides a first exposure with labelled and explained notes", async () => {
    await renderWorkspace(returnPath);

    expect(
      screen.getByText(
        "Guided: notes and their explanations appear on their own.",
      ),
    ).toBeTruthy();
    enter();
    expect(targetNotes().join(" · ")).toContain("delay slot");
    expect(screen.getByRole("list", { name: "Annotations" })).toBeTruthy();
    expect(scanNotes().length).toBeGreaterThan(0);
  });

  it("leaves explanations to Scan once the skill is practiced", async () => {
    await renderWorkspace(returnPath, { player: practicedReturn() });

    expect(
      screen.getByText("Assisted: short labels appear; Scan explains them."),
    ).toBeTruthy();
    enter();
    expect(targetNotes().join(" · ")).toContain("delay slot");
    expect(screen.queryByRole("list", { name: "Annotations" })).toBeNull();
    expect(scanNotes().join("\n")).toContain("delay slot");
  });

  it("shows no notes under the minimal setting, keeping Scan, hints, and the manual", async () => {
    await renderWorkspace(returnPath, {
      player: { ...emptyPlayerState(), settings: { scaffold: "minimal" } },
    });
    enter();

    expect(targetNotes().filter(Boolean)).toEqual(["Note"]);
    expect(screen.queryByRole("list", { name: "Annotations" })).toBeNull();
    expect(button("Hint")).toBeTruthy();
    expect(button("Manual")).toBeTruthy();
    expect(scanNotes().join("\n")).toContain("delay slot");
  });

  it("gives the mission's full help under the full setting, whatever the evidence", async () => {
    await renderWorkspace(returnPath, {
      player: practicedReturn({ scaffold: "full" }),
    });
    enter();

    expect(screen.getByRole("list", { name: "Annotations" })).toBeTruthy();
  });

  it("shows a guided memory diagram inline, with its caption in words", async () => {
    await renderWorkspace(loadWord);
    enter();

    const diagram = screen.getByRole("region", { name: "Machine diagram" });
    expect(
      within(diagram).getByText(loadWord.example?.caption ?? ""),
    ).toBeTruthy();
    expect(
      within(diagram).getByRole("table", { name: "Memory: int at p" })
        .textContent,
    ).toContain("Word 0 loads 4 bytes into $v0");
  });

  it("keeps the memory diagrams of 006, 007, 009, and 010 inline at guided", async () => {
    for (const id of ["006", "007", "009", "010"]) {
      const { unmount } = await renderWorkspace(shippedMission(id));
      enter();
      expect(
        screen.getByRole("region", { name: "Machine diagram" }),
        id,
      ).toBeTruthy();
      unmount();
    }
  });

  it("shows a guided walkthrough inline and names the teaching support", async () => {
    await renderWorkspace(returnPath);
    enter();

    const walkthrough = screen.getByRole("region", { name: "Walkthrough" });
    expect(
      within(walkthrough).getByRole("table", { name: "Step by step" })
        .textContent,
    ).toContain("The delay slot runs");
    expect(
      screen.getByText(
        "Teaching support · Guided: notes and their explanations appear on their own.",
      ),
    ).toBeTruthy();
  });

  it("keeps an assisted mission's walkthrough in Scan, and says support is assisted", async () => {
    await renderWorkspace(shippedMission("005"));
    enter();

    expect(screen.queryByRole("region", { name: "Walkthrough" })).toBeNull();
    expect(
      screen.getByText(
        "Teaching support · Assisted: short labels appear; Scan explains them.",
      ),
    ).toBeTruthy();
    fireEvent.click(button("Scan"));
    fireEvent.click(screen.getByRole("radio", { name: "Walkthrough" }));
    expect(
      screen.getByRole("table", { name: "Step by step" }).textContent,
    ).toContain("5 × 4 = 20");
  });

  it("moves the memory diagram to Scan once the skill is practiced", async () => {
    await renderWorkspace(loadWord, {
      player: practicedSkill("MIPS.LOAD.WORD"),
    });
    enter();

    expect(
      screen.queryByRole("region", { name: "Machine diagram" }),
    ).toBeNull();
    fireEvent.click(button("Scan"));
    fireEvent.click(screen.getByRole("radio", { name: "Memory" }));
    expect(
      screen.getByRole("table", { name: "Memory: int at p" }).textContent,
    ).toContain("0x1000");
  });

  it("keeps linked manual entries when an independent mission shows no notes", async () => {
    await renderWorkspace(qualification);

    // A synthesis mission's practiced skills are its prerequisites.
    expect(screen.getByText("Pointer dereference · New")).toBeTruthy();
    enter();
    expect(targetNotes().filter(Boolean)).toEqual(["Note"]);
    fireEvent.click(button("Manual"));
    const manual = screen.getByRole("region", { name: "Manual" });
    expect(
      within(manual).getByRole("heading", { name: "Assembler-inserted nops" }),
    ).toBeTruthy();
  });
});

describe("Workspace progress", () => {
  const edited = (addend: number) =>
    `int add_immediate(int a) { return a + ${String(addend)}; }\n`;

  it("records the mission as started only once the player enters", async () => {
    const { progress } = await renderWorkspace(addImmediate);
    expect(progress.backing.player.missions["003"]).toBeUndefined();

    enter();

    await waitFor(() => {
      expect(progress.backing.player.missions["003"]?.source).toBe(
        addImmediate.starterSource,
      );
    });
  });

  it("resumes from saved source and the hints already opened", async () => {
    const player = {
      ...emptyPlayerState(),
      missions: {
        "003": missionProgress({ source: edited(9), hintMaxStage: 2 }),
      },
    };
    await renderWorkspace(addImmediate, { player });
    enter();

    expect(editorView().state.doc.toString()).toBe(edited(9));
    fireEvent.click(button("Hint"));
    expect(
      within(screen.getByRole("region", { name: "Hints" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(2);
  });

  it("saves edited source after a pause, and at once when the workspace closes", async () => {
    const { progress, close } = await renderWorkspace(addImmediate);
    enter();
    const saved = () => progress.backing.player.missions["003"]?.source;

    replaceSource(edited(1));
    await waitFor(
      () => {
        expect(saved()).toBe(edited(1));
      },
      { timeout: 3000 },
    );

    replaceSource(edited(2));
    close();
    // Well inside the save delay, so only the flush on closing can explain it.
    await waitFor(
      () => {
        expect(saved()).toBe(edited(2));
      },
      { timeout: 400 },
    );
  });

  it("shows whether progress is saved", async () => {
    const { progress } = await renderWorkspace(addImmediate);
    enter();
    expect(await screen.findByText("SAVED")).toBeTruthy();

    const pending = deferred<undefined>();
    vi.spyOn(progress.storage.persistence, "save")
      .mockImplementationOnce(() => pending.promise)
      .mockRejectedValueOnce(saveDataError("quota"));
    const revealHint = () => {
      fireEvent.click(button("Hint"));
      fireEvent.click(
        within(screen.getByRole("region", { name: "Hints" })).getByRole(
          "button",
          { name: "Reveal next hint" },
        ),
      );
      fireEvent.click(button("Hint"));
    };

    revealHint();
    expect(await screen.findByText("SAVING")).toBeTruthy();
    await act(async () => {
      pending.resolve(undefined);
      await pending.promise;
    });
    expect(await screen.findByText("SAVED")).toBeTruthy();

    revealHint();
    expect(await screen.findByText("NOT SAVED")).toBeTruthy();
  });

  it("records an attempt for each comparison, and none for a failed build", async () => {
    const service = fakeToolchain(mismatch003);
    const { progress } = await renderWorkspace(addImmediate, { service });
    enter();
    const attempts = () => progress.backing.player.missions["003"]?.attempts;

    await compileWhenReady();
    await waitFor(() => {
      expect(attempts()).toHaveLength(1);
    });
    expect(attempts()?.[0]).toMatchObject({
      missionId: "003",
      source: addImmediate.starterSource,
      exact: false,
      compilerBuildId: "compiler-build",
      preprocessorBuildId: "preprocessor-build",
      psyqAsmVersion: "0.2.0",
      aspsxVersion: "2.77",
      pinned: false,
    });

    service.build.mockResolvedValue({
      kind: "compiler-failure",
      diagnostics: [],
    });
    await compileWhenReady();
    await waitFor(() => {
      expect(statusText()).toBe("BUILD FAILED");
    });
    expect(attempts()).toHaveLength(1);
  });

  it("records completion evidence once per visit, and again on a replay", async () => {
    const service = fakeToolchain(exact003);
    const { progress, close, reopen } = await renderWorkspace(addImmediate, {
      service,
    });
    const [taught] = addImmediate.teaches;
    if (taught === undefined) {
      throw new Error("Mission 003 teaches a skill.");
    }
    const mission = () => progress.backing.player.missions["003"];
    const evidence = () => progress.backing.player.skills[taught]?.evidence;
    enter();

    await compileWhenReady();
    await screen.findByRole("heading", { name: "Mission complete" });
    await waitFor(() => {
      expect(mission()?.completion?.count).toBe(1);
    });
    expect(evidence()).toEqual([
      expect.objectContaining({
        missionId: "003",
        kind: "introduced",
        hintMaxStage: 0,
        solutionRevealed: false,
      }),
    ]);

    fireEvent.click(button("Review workspace"));
    fireEvent.click(button("Hint"));
    fireEvent.click(
      within(screen.getByRole("region", { name: "Hints" })).getByRole(
        "button",
        { name: "Reveal next hint" },
      ),
    );
    await compileWhenReady();
    await waitFor(() => {
      expect(mission()?.attempts).toHaveLength(2);
    });
    expect(mission()?.hintMaxStage).toBe(1);
    expect(mission()?.completion?.count).toBe(1);
    expect(evidence()).toHaveLength(1);

    close();
    await reopen();
    enter();
    await compileWhenReady();
    await screen.findByRole("heading", { name: "Mission complete" });
    await waitFor(() => {
      expect(mission()?.completion?.count).toBe(2);
    });
    expect(evidence()).toHaveLength(2);
    expect(evidence()?.[1]).toMatchObject({ hintMaxStage: 1 });
  });

  it("says a revealed solution held skills back and practices again from the starter", async () => {
    const service = fakeToolchain(exact003);
    const { progress } = await renderWorkspace(addImmediate, { service });
    const mission = () => progress.backing.player.missions["003"];
    enter();

    fireEvent.click(button("Hint"));
    const hints = screen.getByRole("region", { name: "Hints" });
    for (let stage = 1; stage < addImmediate.hints.length; stage += 1) {
      fireEvent.click(
        within(hints).getByRole("button", { name: "Reveal next hint" }),
      );
    }
    fireEvent.click(
      within(hints).getByRole("button", { name: "Reveal the solution" }),
    );
    replaceSource(addImmediate.solution ?? "");
    await compileWhenReady();
    await screen.findByRole("heading", { name: "Mission complete" });
    await waitFor(() => {
      expect(screen.getByText("MODE").nextElementSibling?.textContent).toBe(
        "Solution revealed",
      );
    });
    await waitFor(() => {
      expect(mission()?.hintMaxStage).toBe(9);
    });

    fireEvent.click(button("Practice again"));
    expect(
      screen.queryByRole("heading", { name: "Mission complete" }),
    ).toBeNull();
    expect(editorView().state.doc.toString()).toBe(addImmediate.starterSource);
    expect(statusText()).toBe("NOT COMPILED");
    await waitFor(() => {
      expect(mission()).toMatchObject({
        source: addImmediate.starterSource,
        hintMaxStage: 0,
        completion: { count: 1 },
      });
    });
  });

  it("keeps attempts in history to pin, restore, and clear", async () => {
    const service = fakeToolchain(mismatch003);
    const { progress } = await renderWorkspace(addImmediate, { service });
    enter();
    const history = () => screen.getByRole("region", { name: "History" });
    const rows = () => within(history()).getAllByRole("listitem");
    const row = (index: number) => {
      const found = rows()[index];
      if (found === undefined) {
        throw new Error(`History has no row ${String(index)}.`);
      }
      return found;
    };
    const attempts = () =>
      progress.backing.player.missions["003"]?.attempts ?? [];

    // With no saved progress for the mission, history is empty.
    act(() => {
      progress.dispatch({ type: "state-replaced", state: emptyPlayerState() });
    });
    fireEvent.click(button("History"));
    expect(history().textContent).toContain("Each compile");
    fireEvent.click(within(history()).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "History" })).toBeNull();

    await compileWhenReady();
    await waitFor(() => {
      expect(attempts()).toHaveLength(1);
    });
    replaceSource(edited(4));
    await compileWhenReady();
    await waitFor(() => {
      expect(attempts()).toHaveLength(2);
    });

    fireEvent.click(button("History"));
    expect(rows()).toHaveLength(2);
    fireEvent.click(within(row(1)).getByRole("button", { name: "Pin" }));
    await waitFor(() => {
      expect(
        within(row(1))
          .getByRole("button", { name: "Pin" })
          .getAttribute("aria-pressed"),
      ).toBe("true");
    });
    expect(
      attempts().find((a) => a.source === addImmediate.starterSource)?.pinned,
    ).toBe(true);

    fireEvent.click(within(row(1)).getByRole("button", { name: "Restore" }));
    expect(screen.queryByRole("region", { name: "History" })).toBeNull();
    expect(editorView().state.doc.toString()).toBe(addImmediate.starterSource);
    expect(statusText()).toBe("NOT AN EXACT MATCH · STALE");

    fireEvent.click(button("History"));
    fireEvent.click(within(row(1)).getByRole("button", { name: "Restore" }));
    expect(editorView().state.doc.toString()).toBe(addImmediate.starterSource);
    fireEvent.click(button("History"));
    fireEvent.click(within(row(0)).getByRole("button", { name: "Restore" }));
    expect(editorView().state.doc.toString()).toBe(edited(4));
    await waitFor(() => {
      expect(statusText()).toBe("NOT AN EXACT MATCH");
    });

    fireEvent.click(button("History"));
    fireEvent.click(
      within(history()).getByRole("button", { name: "Clear history" }),
    );
    fireEvent.click(within(history()).getByRole("button", { name: "Clear" }));
    await waitFor(() => {
      expect(rows()).toHaveLength(1);
    });
    expect(attempts()).toHaveLength(1);
    fireEvent.keyDown(history(), { key: "Escape" });
    expect(screen.queryByRole("region", { name: "History" })).toBeNull();
  });
});

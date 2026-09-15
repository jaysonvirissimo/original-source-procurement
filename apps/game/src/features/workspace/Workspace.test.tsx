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
}

/** Renders the workspace inside memory-backed progress, once it has loaded. */
async function renderWorkspace(mission: Mission, options: RenderOptions = {}) {
  const service = options.service ?? fakeToolchain();
  const progress = memoryProgress(options.player);
  const tree = (content: ReactElement) =>
    progress.wrap(
      <ToolchainProvider
        createToolchain={
          options.createToolchain ?? (() => Promise.resolve(service))
        }
      >
        {options.upstream === undefined ? (
          content
        ) : (
          <UpstreamContext value={options.upstream}>{content}</UpstreamContext>
        )}
      </ToolchainProvider>,
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

    fireEvent.click(button("Continue"));
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
    const marks: string[] = [];
    forEachDiagnostic(editorView().state, (diagnostic) => {
      marks.push(diagnostic.message);
    });
    expect(marks).toEqual([`${message}\n${guidance}`]);
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
    // The workspace's match summary stays visible beside the completion panel.
    expect(
      within(
        screen.getByRole("region", { name: "Mission complete" }),
      ).getByText("NO"),
    ).toBeTruthy();
  });

  it("completes a prediction mission after a wrong prediction and a matched build, recording the prediction", async () => {
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

    // The correction shows alongside completion, before the player continues.
    expect(screen.getByText("PREDICTION").nextElementSibling?.textContent).toBe(
      "Not correct: you chose $v0; the answer is $a0.",
    );
    expect(
      screen.getByRole("region", { name: "Prediction" }).textContent,
    ).toContain("Your prediction was not correct.");

    fireEvent.click(button("Continue"));
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

  it("opens the manual over the workspace without losing the source", async () => {
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

  it("explains that a mission with a remote target cannot load in this build", async () => {
    await renderWorkspace(realMission());
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

    fireEvent.click(button("Continue"));
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

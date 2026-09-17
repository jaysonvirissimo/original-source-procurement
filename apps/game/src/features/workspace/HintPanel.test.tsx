import type { Hint, RemoteCReference } from "@osp/mission-schema";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { UpstreamOutcome, UpstreamService } from "../upstream/types";
import { offlineUpstream, UpstreamContext } from "../upstream/upstreamContext";
import { HintPanel } from "./HintPanel";

// Every reference and source line here is OSP-authored test content.
const declaration: RemoteCReference = {
  repository: "FoxdieTeam/mgs_reversing",
  commit: "a".repeat(40),
  path: "source/example.h",
  sha256: "b".repeat(64),
  lines: { start: 3, end: 5 },
};

const hints: Hint[] = [
  { stage: 1, text: "Name the skill." },
  { stage: 5, text: "Read this declaration.", reveal: declaration },
];

function panel(
  stage: number,
  upstream: UpstreamService,
  mission: { hints: Hint[]; solution?: string } = { hints },
): ReactElement {
  return (
    <UpstreamContext.Provider value={upstream}>
      <HintPanel
        mission={mission}
        stage={stage}
        onReveal={vi.fn()}
        onClose={vi.fn()}
      />
    </UpstreamContext.Provider>
  );
}

function loader(...outcomes: UpstreamOutcome<string>[]) {
  const loadC = vi.fn<UpstreamService["loadC"]>();
  for (const outcome of outcomes) {
    loadC.mockResolvedValueOnce(outcome);
  }
  return { upstream: { ...offlineUpstream, loadC }, loadC };
}

function region(): HTMLElement {
  return screen.getByRole("region", { name: "Hints" });
}

describe("HintPanel", () => {
  it("names each stage's purpose and marks verified facts and hypotheses", () => {
    render(
      panel(9, offlineUpstream, {
        hints: [
          { stage: 1, text: "A known fact.", verified: true },
          { stage: 3, text: "A guess.", verified: false },
          { stage: 9, text: "The answer.", revealSolution: true },
        ],
        solution: "int f(void) { return 0; }\n",
      }),
    );

    const items = within(region()).getAllByRole("listitem");
    expect(items.map((item) => item.firstElementChild?.textContent)).toEqual([
      "Hint 1 of 2 · Skill",
      "Hint 2 of 2 · Machine behavior",
      "Solution reveal",
    ]);
    expect(items[0]?.textContent).toContain("VERIFIED");
    expect(items[1]?.textContent).toContain("HYPOTHESIS");
    expect(items[2]?.textContent).not.toMatch(/VERIFIED|HYPOTHESIS/);
    expect(within(region()).getByLabelText("Solution").textContent).toBe(
      "int f(void) { return 0; }\n",
    );
  });

  it("warns about the skill consequence only before the solution reveal", () => {
    const ladder: Hint[] = [
      { stage: 1, text: "Name the skill." },
      { stage: 9, text: "The answer.", revealSolution: true },
    ];
    const notice = /does not advance skills/;
    const { rerender } = render(
      panel(0, offlineUpstream, { hints: ladder, solution: "" }),
    );
    expect(within(region()).queryByText(notice)).toBeNull();

    rerender(panel(1, offlineUpstream, { hints: ladder, solution: "" }));
    expect(within(region()).getByText(notice)).toBeTruthy();
    expect(
      within(region()).getByRole("button", { name: "Reveal the solution" }),
    ).toBeTruthy();

    rerender(panel(9, offlineUpstream, { hints: ladder, solution: "" }));
    expect(within(region()).queryByText(notice)).toBeNull();
  });

  it("loads upstream source only once its stage is revealed, and shows it read-only", async () => {
    const { upstream, loadC } = loader({
      kind: "loaded",
      value: "struct Example {\n    int id;\n};\n",
      source: "cache",
    });
    const { rerender } = render(panel(1, upstream));

    expect(loadC).not.toHaveBeenCalled();
    rerender(panel(5, upstream));

    await waitFor(() => {
      expect(
        within(region()).getByLabelText("Upstream source").textContent,
      ).toBe("struct Example {\n    int id;\n};\n");
    });
    expect(loadC).toHaveBeenCalledOnce();
    expect(loadC.mock.calls[0]?.[0]).toBe(declaration);
    expect(region().textContent).toContain("source/example.h, lines 3–5");
    expect(
      within(region())
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Close", "No more hints"]);
  });

  it("shows a loading state, then a specific error with Retry", async () => {
    const { upstream, loadC } = loader(
      { kind: "unavailable", attempts: [] },
      {
        kind: "loaded",
        value: "int id;\n",
        source: "raw.githubusercontent.com",
      },
    );
    render(panel(5, upstream));

    expect(within(region()).getByRole("status").textContent).toBe(
      "Loading the upstream source…",
    );
    const alert = await within(region()).findByRole("alert");
    expect(alert.textContent).toContain("couldn't reach it");
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(
        within(region()).getByLabelText("Upstream source").textContent,
      ).toBe("int id;\n");
    });
    expect(loadC).toHaveBeenCalledTimes(2);
  });

  it("says when downloaded source failed its check, and treats a cancelled load as unavailable", async () => {
    const mismatch = loader({ kind: "content-mismatch", attempts: [] });
    const { unmount } = render(panel(5, mismatch.upstream));
    expect((await within(region()).findByRole("alert")).textContent).toContain(
      "didn't match what it expected",
    );
    unmount();

    const cancelled = loader({ kind: "cancelled" });
    render(panel(5, cancelled.upstream));
    expect((await within(region()).findByRole("alert")).textContent).toContain(
      "couldn't reach it",
    );
  });

  it("stops a load when the panel closes, and shows a reference without a line span", async () => {
    let resolve: (outcome: UpstreamOutcome<string>) => void = () => undefined;
    const loadC = vi.fn<UpstreamService["loadC"]>(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const wholeFile: RemoteCReference = {
      repository: declaration.repository,
      commit: declaration.commit,
      path: declaration.path,
      sha256: declaration.sha256,
    };
    const { unmount } = render(
      panel(
        5,
        { ...offlineUpstream, loadC },
        {
          hints: [{ stage: 5, text: "Read it.", reveal: wholeFile }],
        },
      ),
    );

    expect(region().textContent).toContain("source/example.h");
    expect(region().textContent).not.toContain("lines");
    const signal = loadC.mock.calls[0]?.[1];
    unmount();
    expect(signal?.aborted).toBe(true);
    resolve({ kind: "loaded", value: "late", source: "cache" });
    await Promise.resolve();
  });
});

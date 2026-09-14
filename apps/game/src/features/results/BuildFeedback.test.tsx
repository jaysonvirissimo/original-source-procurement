import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BuildRequest, MissionResult } from "../workspace/missionResult";
import { BuildFeedback } from "./BuildFeedback";

const request: BuildRequest = {
  missionId: "003",
  buildId: 1,
  sourceSha256: "a".repeat(64),
};

type Feedback = Exclude<MissionResult, { kind: "matched" }>;

function failed(
  outcome: Extract<Feedback, { kind: "build-failed" }>["outcome"],
) {
  return { kind: "build-failed", request, outcome } satisfies Feedback;
}

describe("BuildFeedback", () => {
  it.each([
    [failed({ kind: "cancelled" }), "Compile cancelled."],
    [
      failed({ kind: "timeout", timeoutMs: 30_000 }),
      "The compile ran longer than 30 seconds and was stopped.",
    ],
    [
      failed({ kind: "infrastructure-failure", message: "worker crashed" }),
      "The toolchain failed to run: worker crashed",
    ],
  ] as const)("describes %o", (result, text) => {
    render(<BuildFeedback result={result} stale={false} />);

    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Diagnostics" })).toBeNull();
  });

  it("presents an assembler failure as a toolchain defect with its diagnostics", () => {
    render(
      <BuildFeedback
        result={failed({
          kind: "assembler-failure",
          compilerText: "",
          diagnostics: [
            {
              severity: "error",
              file: "add_immediate.s",
              line: 4,
              code: "unknown-directive",
              message: "unknown directive",
            },
          ],
        })}
        stale={false}
      />,
    );

    expect(screen.getByText(/not in your C/)).toBeTruthy();
    expect(screen.getByRole("list", { name: "Diagnostics" }).textContent).toBe(
      "add_immediate.s:4: error: unknown directive",
    );
  });

  it("omits an empty diagnostics list and labels a stale build", () => {
    render(
      <BuildFeedback
        result={failed({ kind: "compiler-failure", diagnostics: [] })}
        stale
      />,
    );

    expect(screen.getByText("The compiler reported errors.")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Diagnostics" })).toBeNull();
    expect(screen.getByText(/^STALE/)).toBeTruthy();
  });

  it("names the expected function and every function found", () => {
    render(
      <BuildFeedback
        result={{
          kind: "function-missing",
          request,
          symbol: "add_immediate",
          definedFunctions: ["add_five", "helper"],
        }}
        stale={false}
      />,
    );

    const region = screen.getByRole("region", { name: "Build feedback" });
    expect(region.textContent).toBe(
      "The build defined no function named add_immediate.Functions found: add_five, helper",
    );
  });
});

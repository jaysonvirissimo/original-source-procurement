import type { WorkspaceState } from "./workspaceReducer";

/** The one-line match state shown in the workspace header. */
export function matchStatus(state: WorkspaceState, stale: boolean): string {
  if (state.compiling !== undefined) {
    return "COMPILING";
  }
  const { result } = state;
  if (result === undefined) {
    return "NOT COMPILED";
  }
  let label: string;
  switch (result.kind) {
    case "matched":
      label = result.result.exact ? "EXACT MATCH" : "NOT AN EXACT MATCH";
      break;
    case "function-missing":
      label = "FUNCTION MISSING";
      break;
    case "build-failed":
      label = "BUILD FAILED";
      break;
  }
  return stale ? `${label} · STALE` : label;
}

/** The header line shown while the workspace still shows saved work. */
export function restoredLabel(earlierAttempts: number): string {
  if (earlierAttempts === 0) {
    return "Saved work restored";
  }
  const noun = earlierAttempts === 1 ? "attempt" : "attempts";
  return `Saved work restored · ${String(earlierAttempts)} earlier ${noun} in History`;
}

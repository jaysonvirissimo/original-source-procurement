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

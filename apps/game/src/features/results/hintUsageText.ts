import type { HintUsage } from "../workspace/workspaceReducer";

/** `None`, or `2 of 5 · stage 4`. */
export function hintUsageText({ opened, available, stage }: HintUsage): string {
  return opened === 0
    ? "None"
    : `${String(opened)} of ${String(available)} · stage ${String(stage)}`;
}

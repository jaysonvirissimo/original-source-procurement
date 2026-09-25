import type { HintUsage } from "../workspace/workspaceReducer";

/** `None`, `Through Hint 2 of 5`, or `Through Solution reveal`. */
export function hintUsageText({ reached }: HintUsage): string {
  return reached === undefined ? "None" : `Through ${reached}`;
}

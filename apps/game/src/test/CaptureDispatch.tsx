import { useEffect } from "react";
import { usePlayerProgress } from "../features/persistence/progressContext";
import type { ProgressEvent } from "../features/progress/progressReducer";

export type ProgressDispatch = (event: ProgressEvent) => void;

/** Hands the mounted provider's dispatch to a test. Renders nothing. */
export function CaptureDispatch({
  onDispatch,
}: {
  readonly onDispatch: (dispatch: ProgressDispatch) => void;
}): null {
  const { dispatch } = usePlayerProgress();
  useEffect(() => {
    onDispatch(dispatch);
  });
  return null;
}

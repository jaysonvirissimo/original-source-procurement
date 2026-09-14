import type { KeyboardEvent, PointerEvent, ReactElement } from "react";
import styles from "./SplitHandle.module.css";
import { SPLIT_LIMITS } from "./workspaceReducer";

const STEP = 0.05;

interface SplitHandleProps {
  /** The editor's share of the width. */
  readonly value: number;
  readonly onChange: (value: number) => void;
}

/** Resizes the editor and assembly panels with arrow keys or by dragging. */
export function SplitHandle({
  value,
  onChange,
}: SplitHandleProps): ReactElement {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = keyTarget(event.key, value);
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    onChange(next);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const container = event.currentTarget.parentElement;
    /* v8 ignore next 3 -- the handle always sits inside the split. */
    if (container === null) {
      return;
    }
    event.preventDefault();
    const move = (moveEvent: globalThis.PointerEvent) => {
      const { left, width } = container.getBoundingClientRect();
      if (width > 0) {
        onChange((moveEvent.clientX - left) / width);
      }
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  return (
    <div
      className={styles.handle}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the editor and assembly panels"
      aria-valuemin={SPLIT_LIMITS.min * 100}
      aria-valuemax={SPLIT_LIMITS.max * 100}
      aria-valuenow={Math.round(value * 100)}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
    />
  );
}

function keyTarget(key: string, value: number): number | undefined {
  switch (key) {
    case "ArrowLeft":
      return value - STEP;
    case "ArrowRight":
      return value + STEP;
    case "Home":
      return SPLIT_LIMITS.min;
    case "End":
      return SPLIT_LIMITS.max;
    default:
      return undefined;
  }
}

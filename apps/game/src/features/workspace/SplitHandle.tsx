import type { KeyboardEvent, PointerEvent, ReactElement } from "react";
import styles from "./SplitHandle.module.css";
import { SPLIT_LIMITS } from "./workspaceReducer";

interface SplitHandleProps {
  /** The editor's share of the width, or whatever `fromPointer` measures. */
  readonly value: number;
  readonly onChange: (value: number) => void;
  /** Called once a drag ends or a key moves the handle. */
  readonly onCommit?: (value: number) => void;
  readonly label?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  /**
   * The value for a pointer at `clientX` in the container's box, or
   * undefined when the box has no width.
   */
  readonly fromPointer?: (clientX: number, box: DOMRect) => number | undefined;
  /** Scales `value` for `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`. */
  readonly ariaScale?: number;
  /** -1 when ArrowRight should lower the value, as when resizing from the right. */
  readonly direction?: 1 | -1;
}

/** Resizes neighbouring panels with arrow keys or by dragging. */
export function SplitHandle({
  value,
  onChange,
  onCommit,
  label = "Resize the editor and assembly panels",
  min = SPLIT_LIMITS.min,
  max = SPLIT_LIMITS.max,
  step = 0.05,
  fromPointer = shareOfWidth,
  ariaScale = 100,
  direction = 1,
}: SplitHandleProps): ReactElement {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = keyTarget(event.key, value, {
      min,
      max,
      step: step * direction,
    });
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    onChange(next);
    onCommit?.(next);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const container = event.currentTarget.parentElement;
    /* v8 ignore next 3 -- the handle always sits inside the split. */
    if (container === null) {
      return;
    }
    event.preventDefault();
    let latest: number | undefined;
    const move = (moveEvent: globalThis.PointerEvent) => {
      const next = fromPointer(
        moveEvent.clientX,
        container.getBoundingClientRect(),
      );
      if (next !== undefined) {
        latest = next;
        onChange(next);
      }
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      if (latest !== undefined) {
        onCommit?.(latest);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  return (
    <div
      className={styles.handle}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min * ariaScale}
      aria-valuemax={max * ariaScale}
      aria-valuenow={Math.round(value * ariaScale)}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
    />
  );
}

function shareOfWidth(clientX: number, box: DOMRect): number | undefined {
  return box.width > 0 ? (clientX - box.left) / box.width : undefined;
}

function keyTarget(
  key: string,
  value: number,
  { min, max, step }: { min: number; max: number; step: number },
): number | undefined {
  switch (key) {
    case "ArrowLeft":
      return value - step;
    case "ArrowRight":
      return value + step;
    case "Home":
      return min;
    case "End":
      return max;
    default:
      return undefined;
  }
}

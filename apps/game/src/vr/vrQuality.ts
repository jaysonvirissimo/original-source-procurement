/** The highest device pixel ratio the background renders at. */
export const MAX_PIXEL_RATIO = 1.5;

/** The background's render resolution for a device pixel ratio. */
export function pixelRatio(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
    return 1;
  }
  return Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
}

/** When React Three Fiber renders frames. */
export type FrameLoop = "always" | "demand" | "never";

/**
 * A hidden page renders nothing. Reduced motion renders only when the scene
 * changes, so nothing moves on its own.
 */
export function frameLoop(options: {
  readonly hidden: boolean;
  readonly reducedMotion: boolean;
}): FrameLoop {
  if (options.hidden) {
    return "never";
  }
  return options.reducedMotion ? "demand" : "always";
}

interface ContextSource {
  getContext(contextId: "webgl2" | "webgl"): unknown;
}

/** Whether this browser can create a WebGL context. */
export function webglAvailable(
  createCanvas: () => ContextSource = () => document.createElement("canvas"),
): boolean {
  try {
    const canvas = createCanvas();
    return (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) !== null;
  } catch {
    return false;
  }
}

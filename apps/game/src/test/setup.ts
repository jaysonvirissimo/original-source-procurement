import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest globals are disabled, so Testing Library cannot register its own
// automatic cleanup.
afterEach(() => {
  cleanup();
});

// CodeMirror measures text through Range geometry, which jsdom does not
// implement. Layout is irrelevant to these tests, so every rectangle is empty.
const emptyRect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  toJSON: () => ({}),
} as DOMRect;
Range.prototype.getBoundingClientRect = () => emptyRect;
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;

// Pointer events carry mouse coordinates; jsdom may lack the constructor.
if (!("PointerEvent" in window)) {
  Object.defineProperty(window, "PointerEvent", { value: MouseEvent });
}

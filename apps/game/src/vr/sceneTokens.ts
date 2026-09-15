export const SCENE_TOKENS = [
  "void",
  "grid",
  "gridDim",
  "line",
  "info",
  "match",
  "error",
] as const;
export type SceneToken = (typeof SCENE_TOKENS)[number];
export type SceneColors = Readonly<Record<SceneToken, string>>;

const PROPERTIES: Readonly<Record<SceneToken, string>> = {
  void: "--osp-void",
  grid: "--osp-grid",
  gridDim: "--osp-grid-dim",
  line: "--osp-line",
  info: "--osp-info",
  match: "--osp-match",
  error: "--osp-error",
};

/**
 * Reads the scene's palette from the design tokens, so the 3D layer defines
 * no colors of its own. Undefined when any token is missing, in which case
 * the scene is not drawn.
 */
export function sceneColors(
  style: Pick<CSSStyleDeclaration, "getPropertyValue">,
): SceneColors | undefined {
  const colors: Partial<Record<SceneToken, string>> = {};
  for (const token of SCENE_TOKENS) {
    const value = style.getPropertyValue(PROPERTIES[token]).trim();
    if (value === "") {
      return undefined;
    }
    colors[token] = value;
  }
  return colors as SceneColors;
}

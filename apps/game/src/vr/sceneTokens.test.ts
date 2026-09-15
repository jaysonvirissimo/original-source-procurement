import { describe, expect, it } from "vitest";
import { SCENE_TOKENS, sceneColors } from "./sceneTokens";

function style(values: Record<string, string>) {
  return { getPropertyValue: (property: string) => values[property] ?? "" };
}

const TOKENS = {
  "--osp-void": " #000001",
  "--osp-grid": "#000002",
  "--osp-grid-dim": "#000003",
  "--osp-line": "#000004",
  "--osp-info": "#000005",
  "--osp-match": "#000006",
  "--osp-error": "#000007 ",
};

describe("sceneColors", () => {
  it("reads every scene color from its design token, trimmed", () => {
    expect(sceneColors(style(TOKENS))).toEqual({
      void: "#000001",
      grid: "#000002",
      gridDim: "#000003",
      line: "#000004",
      info: "#000005",
      match: "#000006",
      error: "#000007",
    });
  });

  it.each(Object.keys(TOKENS))("gives nothing when %s is missing", (key) => {
    const partial: Record<string, string> = { ...TOKENS };
    partial[key] = "  ";
    expect(sceneColors(style(partial))).toBeUndefined();
  });

  it("lists one token per scene color", () => {
    expect(new Set(SCENE_TOKENS).size).toBe(Object.keys(TOKENS).length);
  });
});

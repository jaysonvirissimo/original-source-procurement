import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { CORPUS_CONFIG } from "./config";

describe("CORPUS_CONFIG", () => {
  it("stamps the corpus with the importer's own package version", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };

    expect(CORPUS_CONFIG.importerVersion).toBe(manifest.version);
  });
});

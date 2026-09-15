import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VENDORED_LICENSES } from "./vendored-licenses";

describe("VENDORED_LICENSES", () => {
  it.each(Object.entries(VENDORED_LICENSES))(
    "%s has a full MIT text copied from its tagged release",
    async (key, entry) => {
      const text = await readFile(
        join(import.meta.dirname, "licenses", entry.file),
        "utf8",
      );

      expect(key).toMatch(/^(?:@[^/@]+\/)?[^/@]+@\d+\.\d+\.\d+$/);
      expect(entry.license).toBe("MIT");
      expect(text).toMatch(/^(?:The )?MIT License\n\nCopyright /);
      expect(text).toContain(
        "The above copyright notice and this permission notice shall be included",
      );
      const version = key.slice(key.lastIndexOf("@") + 1);
      expect(entry.source).toMatch(
        new RegExp(
          `^https://github\\.com/[^/]+/[^/]+/blob/v?${version.replaceAll(".", "\\.")}/LICENSE$`,
        ),
      );
    },
  );
});

import { describe, expect, it } from "vitest";
import { createMemoryStorage, memoryBacking } from "./memoryPersistence";
import { samplePlayer, timestamp } from "./persistence.test-helpers";
import { describeStorageContract } from "./storageContract.test-helpers";

const now = () => timestamp(100);

describeStorageContract("Memory", () => {
  const backing = memoryBacking();
  return {
    open: () => Promise.resolve(createMemoryStorage({ backing, now })),
  };
});

describe("createMemoryStorage", () => {
  it("starts empty by default and closes without effect", async () => {
    const storage = createMemoryStorage();
    storage.close();

    expect((await storage.persistence.load()).missions).toEqual({});
  });

  it("stamps exports with the current time", async () => {
    const storage = createMemoryStorage({
      backing: memoryBacking(samplePlayer()),
      now,
    });
    const file: unknown = JSON.parse(
      await (await storage.persistence.export()).text(),
    );

    expect(file).toMatchObject({ exportedAt: timestamp(100) });
  });

  it("stamps exports with the clock when no time source is given", async () => {
    const storage = createMemoryStorage();
    const before = new Date().toISOString();
    const file = JSON.parse(
      await (await storage.persistence.export()).text(),
    ) as { exportedAt: string };

    expect(file.exportedAt >= before).toBe(true);
  });
});

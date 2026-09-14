/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { missionDrafts } from "@osp/curriculum/drafts";
import type { InlineTarget } from "@osp/mission-schema";
import { format, resolveConfig } from "prettier";
import { assemble } from "psyq-asm";
import { createCompiler } from "psyq-wasm";
import { createToolchainService } from "../../src/features/compiler/toolchainService.ts";
import {
  generateTarget,
  renderTargetModule,
  sameGeneratedTarget,
  targetModulePath,
} from "../generate-targets.ts";

const require = createRequire(import.meta.url);
const psyqAsmVersion = (require("psyq-asm/package.json") as { version: string })
  .version;
const ospCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();

const service = await createToolchainService({
  createCompiler: () => createCompiler(),
  assemble,
  psyqAsmVersion,
});

try {
  for (const draft of missionDrafts) {
    const path = resolve(targetModulePath(draft.id));
    const target = await generateTarget(service, draft, ospCommit);
    if (existsSync(path)) {
      const existing = (
        (await import(pathToFileURL(path).href)) as { target: InlineTarget }
      ).target;
      if (sameGeneratedTarget(existing, target)) {
        console.log(`${draft.id}: unchanged`);
        continue;
      }
    }
    await mkdir(dirname(path), { recursive: true });
    const options = await resolveConfig(path);
    await writeFile(
      path,
      await format(renderTargetModule(target), {
        ...options,
        filepath: path,
      }),
    );
    console.log(`${draft.id}: wrote ${targetModulePath(draft.id)}`);
  }
} finally {
  service.dispose();
}

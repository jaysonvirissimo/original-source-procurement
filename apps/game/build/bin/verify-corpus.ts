/// <reference types="node" />
import { createRequire } from "node:module";
import {
  checkoutsFromEnvironment,
  readImportIndex,
  readOverrides,
  renderReviewReport,
  writeReviewReport,
  writeVerdictIndex,
  MISSING_CHECKOUTS,
  VERDICT_INDEX_PATH,
} from "@osp/mgs-importer";
import { assemble } from "psyq-asm";
import { createCompiler } from "psyq-wasm";
import { createToolchainService } from "../../src/features/compiler/toolchainService.ts";
import { createLocalCheckoutUpstream } from "../../src/test/localCheckoutUpstream.node.ts";
import { verifyCorpus } from "../verify-corpus.ts";

const checkouts = checkoutsFromEnvironment();
if (checkouts === undefined) {
  console.error(MISSING_CHECKOUTS);
  process.exitCode = 1;
} else {
  const require = createRequire(import.meta.url);
  const psyqAsmVersion = (
    require("psyq-asm/package.json") as { version: string }
  ).version;

  const index = await readImportIndex();
  const usedSymbols = new Set(
    (await readOverrides()).missions.map((mission) => mission.symbol),
  );
  const symbols = process.argv.slice(2);
  const service = await createToolchainService({
    createCompiler: () => createCompiler(),
    assemble,
    psyqAsmVersion,
  });

  try {
    const verdicts = await verifyCorpus(
      index,
      service,
      createLocalCheckoutUpstream(checkouts),
      console,
      symbols.length > 0 ? { symbols: new Set(symbols) } : {},
    );
    await writeVerdictIndex(verdicts);
    await writeReviewReport(
      index.upstreamCommit,
      renderReviewReport(index, verdicts, usedSymbols),
    );
    const exact = verdicts.functions.filter(
      (entry) => entry.verdict === "exact",
    ).length;
    console.log(
      `wrote ${VERDICT_INDEX_PATH}: ${String(exact)} of ${String(verdicts.functions.length)} checked functions reproduce exactly`,
    );
  } finally {
    service.dispose();
  }
}

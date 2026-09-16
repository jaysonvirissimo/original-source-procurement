import { createGitReader, type LocalCheckouts } from "./checkout.ts";
import type { PointerCorpus } from "@osp/mission-schema";
import {
  readImportIndex,
  readModuleText,
  readOverrides,
  readVerdictIndex,
  updateReportPath,
  writeImportIndex,
  writeModule,
  writeReviewReport,
  writeUpdateReport,
  IMPORT_INDEX_PATH,
  reviewReportPath,
  type Root,
} from "./artifacts.ts";
import {
  buildCorpus,
  renderCorpusModule,
  CORPUS_MODULE_PATH,
} from "./corpus.ts";
import type { CorpusConfig } from "./config.ts";
import {
  createUpstreamReader,
  runImport,
  type ImportOutput,
} from "./importer.ts";
import { renderReviewReport } from "./report.ts";
import { checkPointers, diffImports, renderUpdateReport } from "./update.ts";

/** What a command prints and how it reports failure. */
export interface CommandOutput extends ImportOutput {
  error(message: string): void;
}

export const MISSING_CHECKOUTS =
  "Set OSP_MGS_REVERSING_DIR and OSP_PSYQ_SDK_DIR to full clones of FoxdieTeam/mgs_reversing and FoxdieTeam/psyq_sdk.";

/** What to print for something thrown, which need not be an `Error`. */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Imports pointers from the pinned checkouts and writes the candidate index
 * and the review report. Returns a process exit code.
 */
export async function runImportCommand(
  checkouts: LocalCheckouts | undefined,
  config: CorpusConfig,
  output: CommandOutput,
  root: Root = ".",
): Promise<number> {
  if (checkouts === undefined) {
    output.error(MISSING_CHECKOUTS);
    return 1;
  }

  const readers = {
    upstream: createGitReader(checkouts.mgsReversing),
    sdk: createGitReader(checkouts.psyqSdk),
  };

  let index;
  try {
    index = await runImport(readers, config, output);
  } catch (error) {
    output.error(messageOf(error));
    return 1;
  }

  await writeImportIndex(index, root);
  await writeReviewReport(
    config.upstreamCommit,
    renderReviewReport(index),
    root,
  );

  const pinned = index.functions.filter(
    (entry) => entry.pinned !== undefined,
  ).length;
  output.log(
    `wrote ${IMPORT_INDEX_PATH}: ${String(index.files.length)} source files, ${String(pinned)} pinned targets`,
  );
  output.log(`wrote ${reviewReportPath(config.upstreamCommit)}`);
  return 0;
}

/**
 * Merges the reviewed overrides into the imported pointers and writes the
 * generated corpus module. Returns a process exit code.
 *
 * The module is rewritten only when it would change, so running the command
 * twice leaves the working tree clean.
 */
export async function runWriteCommand(
  format: FormatModule,
  output: CommandOutput,
  root: Root = ".",
): Promise<number> {
  let contents: string;
  try {
    const [index, verdicts, overrides] = await Promise.all([
      readImportIndex(root),
      readVerdictIndex(root),
      readOverrides(root),
    ]);
    const corpus = buildCorpus(index, verdicts, overrides.missions);
    output.log(
      `corpus: ${String(corpus.missions.length)} reviewed missions at ${corpus.upstreamCommit}`,
    );
    contents = await format(renderCorpusModule(corpus), CORPUS_MODULE_PATH);
  } catch (error) {
    output.error(messageOf(error));
    return 1;
  }

  if ((await readModuleText(CORPUS_MODULE_PATH, root)) === contents) {
    output.log(`${CORPUS_MODULE_PATH}: unchanged`);
    return 0;
  }

  await writeModule(CORPUS_MODULE_PATH, contents, root);
  output.log(`wrote ${CORPUS_MODULE_PATH}`);
  return 0;
}

/** Formats generated source the way the repository formats everything else. */
export type FormatModule = (
  contents: string,
  path: string,
) => Promise<string> | string;

/**
 * Compares the pinned checkout against the last import and reports what a
 * repin would change, including shipped pointers that no longer resolve.
 * It changes nothing; adopting an update means running the import again.
 */
export async function runUpdateCommand(
  checkouts: LocalCheckouts | undefined,
  config: CorpusConfig,
  corpus: PointerCorpus,
  output: CommandOutput,
  root: Root = ".",
): Promise<number> {
  if (checkouts === undefined) {
    output.error(MISSING_CHECKOUTS);
    return 1;
  }

  const readers = {
    upstream: createGitReader(checkouts.mgsReversing),
    sdk: createGitReader(checkouts.psyqSdk),
  };

  let report;
  try {
    const before = await readImportIndex(root);
    if (before.upstreamCommit === config.upstreamCommit) {
      output.error(
        `The last import is already at ${config.upstreamCommit}. Pin a newer commit in the importer config before comparing.`,
      );
      return 1;
    }
    const after = await runImport(readers, config, output);
    const unresolved = await checkPointers(
      corpus,
      createUpstreamReader(readers, config),
    );
    report = { ...diffImports(before, after), unresolved };
  } catch (error) {
    output.error(messageOf(error));
    return 1;
  }

  await writeUpdateReport(
    config.upstreamCommit,
    renderUpdateReport(report),
    root,
  );
  output.log(
    `${String(report.functions.length)} function changes, ${String(report.unresolved.length)} shipped pointers that no longer resolve`,
  );
  output.log(`wrote ${updateReportPath(config.upstreamCommit)}`);
  return 0;
}

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { REPORT_DIRECTORY } from "./config.ts";
import { parseOverrides, OVERRIDES_PATH } from "./overrides.ts";
import type { MissionOverrides } from "./overrides.ts";
import type { ImportIndex, VerdictIndex } from "./records.ts";

/**
 * The repository the corpus files belong to. Every path is relative to it, so
 * a test can point the commands at a directory of its own.
 */
export type Root = string;

/** Where the import index is written and read back from. */
export const IMPORT_INDEX_PATH = `${REPORT_DIRECTORY}/candidates.json`;

/** Where the reproduction verdicts are written and read back from. */
export const VERDICT_INDEX_PATH = `${REPORT_DIRECTORY}/verdicts.json`;

/** Where the reviewer's report is written. */
export function reviewReportPath(upstreamCommit: string): string {
  return `${REPORT_DIRECTORY}/${upstreamCommit}-review.md`;
}

/** Where the update report is written. */
export function updateReportPath(upstreamCommit: string): string {
  return `${REPORT_DIRECTORY}/${upstreamCommit}-update.md`;
}

function under(root: Root, path: string): string {
  return root === "." ? path : `${root}/${path}`;
}

async function write(
  root: Root,
  path: string,
  contents: string,
): Promise<void> {
  const full = under(root, path);
  await mkdir(full.slice(0, full.lastIndexOf("/")), { recursive: true });
  await writeFile(full, contents, "utf8");
}

/** JSON with a trailing newline and a two-space indent. */
export function renderJson(value: unknown): string {
  return `${JSON.stringify(value, undefined, 2)}\n`;
}

export function writeImportIndex(
  index: ImportIndex,
  root: Root = ".",
): Promise<void> {
  return write(root, IMPORT_INDEX_PATH, renderJson(index));
}

export function writeVerdictIndex(
  index: VerdictIndex,
  root: Root = ".",
): Promise<void> {
  return write(root, VERDICT_INDEX_PATH, renderJson(index));
}

export function writeReviewReport(
  upstreamCommit: string,
  contents: string,
  root: Root = ".",
): Promise<void> {
  return write(root, reviewReportPath(upstreamCommit), contents);
}

export function writeUpdateReport(
  upstreamCommit: string,
  contents: string,
  root: Root = ".",
): Promise<void> {
  return write(root, updateReportPath(upstreamCommit), contents);
}

async function readJson<T>(
  root: Root,
  path: string,
  command: string,
): Promise<T> {
  let text: string;
  try {
    text = await readFile(under(root, path), "utf8");
  } catch (error) {
    throw new Error(`${path} is missing. Run ${command} first.`, {
      cause: error,
    });
  }
  return JSON.parse(text) as T;
}

export function readImportIndex(root: Root = "."): Promise<ImportIndex> {
  return readJson<ImportIndex>(root, IMPORT_INDEX_PATH, "pnpm corpus:import");
}

export function readVerdictIndex(root: Root = "."): Promise<VerdictIndex> {
  return readJson<VerdictIndex>(root, VERDICT_INDEX_PATH, "pnpm corpus:verify");
}

/** The reviewed overrides, parsed and checked. */
export async function readOverrides(
  root: Root = ".",
): Promise<MissionOverrides> {
  return parseOverrides(await readFile(under(root, OVERRIDES_PATH), "utf8"));
}

/** Writes a generated module, creating its directory when it is new. */
export function writeModule(
  path: string,
  contents: string,
  root: Root = ".",
): Promise<void> {
  return write(root, path, contents);
}

/** The generated module at this path, or `undefined` when it has none yet. */
export async function readModuleText(
  path: string,
  root: Root = ".",
): Promise<string | undefined> {
  try {
    return await readFile(under(root, path), "utf8");
  } catch {
    return undefined;
  }
}

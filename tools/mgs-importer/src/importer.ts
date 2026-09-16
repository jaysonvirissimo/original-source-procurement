import {
  UPSTREAM_DEFAULT_BUILD,
  type CompilerSettings,
  type RemoteCReference,
} from "@osp/mission-schema";
import { featureTags, functionFacts } from "./analysis.ts";
import type { GitReader } from "./checkout.ts";
import { gpSizeFor, isExcludedSource, overlayFor } from "./buildRules.ts";
import { FUNCTIONS_PATH, type CorpusConfig } from "./config.ts";
import { sha256Hex } from "./hash.ts";
import { deletionsByName, newestDeletion } from "./history.ts";
import { includeClosure, type ReadUpstream } from "./includes.ts";
import {
  isDefaultBuildSource,
  variantOnlySources,
  LINKER_COMMAND_PATH,
} from "./linkerCommands.ts";
import {
  assemblyNames,
  basenameOf,
  parseInventory,
  statusOf,
  type InventoryEntry,
} from "./inventory.ts";
import {
  IMPORT_INDEX_VERSION,
  type FileRecord,
  type FunctionRecord,
  type FunctionRejection,
  type ImportIndex,
} from "./records.ts";
import { buildTarget } from "./target.ts";

/** Progress lines; the caller decides where they go. */
export interface ImportOutput {
  log(message: string): void;
}

export interface ImportReaders {
  readonly upstream: GitReader;
  readonly sdk: GitReader;
}

const FILENAME = /^[A-Za-z0-9_][A-Za-z0-9_.-]*\.c$/;
const ASSEMBLY_INCLUDE = "INCLUDE_ASM";
const decoder = new TextDecoder();

/**
 * Reads blobs at the pinned commits, remembering every file it has read.
 *
 * The include closure of 700 source files touches the same few hundred
 * headers over and over, so reading each one once turns the whole import
 * from many thousands of git invocations into a few hundred.
 */
export function createUpstreamReader(
  readers: ImportReaders,
  config: CorpusConfig,
): ReadUpstream {
  const cache = new Map<string, Promise<Uint8Array | undefined>>();
  return (repository, path) => {
    const key = `${repository}:${path}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const pending =
      repository === "FoxdieTeam/psyq_sdk"
        ? readers.sdk.blob(config.sdkCommit, path)
        : readers.upstream.blob(config.upstreamCommit, path);
    cache.set(key, pending);
    return pending;
  };
}

/** The compiler input upstream's default build gives one source file. */
export function compilerSettingsFor(
  sourcePath: string,
  remoteHeaders: Readonly<Record<string, RemoteCReference>>,
): CompilerSettings {
  return {
    gpSize: gpSizeFor(sourcePath),
    aspsxVersion: UPSTREAM_DEFAULT_BUILD.aspsxVersion,
    rawFlags: [...UPSTREAM_DEFAULT_BUILD.rawFlags],
    cppFlags: [...UPSTREAM_DEFAULT_BUILD.cppFlags],
    encoding: UPSTREAM_DEFAULT_BUILD.encoding,
    filename: basenameOf(sourcePath),
    headers: {},
    remoteHeaders,
  };
}

/**
 * Every source file upstream's default build compiles, with its resolved
 * context. Sources built by the older toolchain, and any whose name the
 * compiler cannot take, are left out.
 */
export async function importFiles(
  paths: readonly string[],
  variantOnly: ReadonlySet<string>,
  read: ReadUpstream,
  config: CorpusConfig,
  output: ImportOutput,
): Promise<FileRecord[]> {
  const files: FileRecord[] = [];
  for (const path of paths) {
    if (
      isExcludedSource(path) ||
      !isDefaultBuildSource(path, variantOnly) ||
      !FILENAME.test(basenameOf(path))
    ) {
      continue;
    }

    const bytes = await read("FoxdieTeam/mgs_reversing", path);
    if (bytes === undefined) continue;
    const text = decoder.decode(bytes);

    const closure = await includeClosure(path, text, read);
    const remoteHeaders: Record<string, RemoteCReference> = {};
    for (const entry of closure) {
      remoteHeaders[entry.key] = {
        repository: entry.repository,
        commit:
          entry.repository === "FoxdieTeam/psyq_sdk"
            ? config.sdkCommit
            : config.upstreamCommit,
        path: entry.path,
        sha256: sha256Hex(entry.bytes),
      };
    }

    files.push({
      path,
      overlay: overlayFor(path),
      gpSize: gpSizeFor(path),
      reference: {
        repository: "FoxdieTeam/mgs_reversing",
        commit: config.upstreamCommit,
        path,
        sha256: sha256Hex(bytes),
      },
      compiler: compilerSettingsFor(path, remoteHeaders),
      includesAssembly: text.includes(ASSEMBLY_INCLUDE),
    });

    if (files.length % 100 === 0) {
      output.log(`resolved context for ${String(files.length)} source files`);
    }
  }
  return files;
}

/**
 * Pins one solved function's target to the parent of the commit that removed
 * its assembly file, and checks the pin: the file must still be there, it must
 * hold `dw` words, and it must hold as many as upstream's inventory records.
 */
export async function importTarget(
  entry: InventoryEntry,
  upstream: GitReader,
  byName: ReadonlyMap<string, readonly { commit: string; path: string }[]>,
): Promise<Pick<FunctionRecord, "pinned" | "rejection">> {
  const deletion = newestDeletion(byName, assemblyNames(entry));
  if (deletion === undefined) return reject("no-deletion");

  const parent = await upstream.resolve(`${deletion.commit}^`);
  if (parent === undefined) return reject("no-parent", deletion.commit);

  const bytes = await upstream.blob(parent, deletion.path);
  if (bytes === undefined) return reject("target-absent", deletion.path);

  const outcome = buildTarget(
    parent,
    deletion.path,
    decoder.decode(bytes),
    entry.size / 4,
  );
  if (!outcome.ok) {
    const { rejection } = outcome;
    return reject(
      rejection.reason,
      rejection.reason === "word-count"
        ? `found ${String(rejection.found)}, expected ${String(rejection.expected)}`
        : deletion.path,
    );
  }

  const facts = functionFacts(outcome.words);
  return {
    pinned: { target: outcome.target, facts, tags: featureTags(facts) },
  };
}

function reject(
  reason: FunctionRejection["reason"],
  detail?: string,
): { rejection: FunctionRejection } {
  return { rejection: detail === undefined ? { reason } : { reason, detail } };
}

/** Reads upstream's inventory and pins every solved function's target. */
export async function importFunctions(
  upstream: GitReader,
  config: CorpusConfig,
  assemblyPaths: readonly string[],
  output: ImportOutput,
): Promise<FunctionRecord[]> {
  const inventoryBytes = await upstream.blob(
    config.upstreamCommit,
    FUNCTIONS_PATH,
  );
  if (inventoryBytes === undefined) {
    throw new Error(
      `${FUNCTIONS_PATH} is missing at ${config.upstreamCommit}. Is the checkout a full clone?`,
    );
  }
  const entries = parseInventory(decoder.decode(inventoryBytes));
  const basenames = new Set(assemblyPaths.map(basenameOf));
  const byName = deletionsByName(
    await upstream.deletions(config.upstreamCommit, "asm"),
  );

  output.log(`inventory: ${String(entries.length)} functions`);

  // A name upstream reuses, usually a file-local helper, cannot be pinned:
  // nothing in a pointer would say which of them a mission means.
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.symbol)) duplicated.add(entry.symbol);
    seen.add(entry.symbol);
  }

  const records: FunctionRecord[] = [];
  for (const entry of entries) {
    const status = statusOf(entry, basenames);
    const base = {
      symbol: entry.symbol,
      address: entry.address,
      size: entry.size,
      status,
    };
    if (duplicated.has(entry.symbol)) {
      records.push({ ...base, ...reject("duplicate-symbol") });
    } else if (status === "LIVE") {
      records.push({ ...base, ...reject("still-unmatched") });
    } else {
      records.push({
        ...base,
        ...(await importTarget(entry, upstream, byName)),
      });
    }
  }
  return records;
}

/** Runs the whole pointer import. Nothing it returns carries upstream content. */
export async function runImport(
  readers: ImportReaders,
  config: CorpusConfig,
  output: ImportOutput,
): Promise<ImportIndex> {
  const read = createUpstreamReader(readers, config);
  const paths = await readers.upstream.paths(config.upstreamCommit);
  const sources = paths.filter(
    (path) => path.startsWith("source/") && path.endsWith(".c"),
  );
  const assembly = paths.filter(
    (path) => path.startsWith("asm/") && path.endsWith(".s"),
  );

  const template = await read("FoxdieTeam/mgs_reversing", LINKER_COMMAND_PATH);
  if (template === undefined) {
    throw new Error(
      `${LINKER_COMMAND_PATH} is missing at ${config.upstreamCommit}. Is the checkout a full clone?`,
    );
  }
  const variantOnly = variantOnlySources(decoder.decode(template));

  const functions = await importFunctions(
    readers.upstream,
    config,
    assembly,
    output,
  );
  const files = await importFiles(sources, variantOnly, read, config, output);

  return {
    schemaVersion: IMPORT_INDEX_VERSION,
    importerVersion: config.importerVersion,
    upstreamCommit: config.upstreamCommit,
    sdkCommit: config.sdkCommit,
    files: files.toSorted((a, b) => a.path.localeCompare(b.path)),
    functions: functions.toSorted((a, b) => a.symbol.localeCompare(b.symbol)),
  };
}

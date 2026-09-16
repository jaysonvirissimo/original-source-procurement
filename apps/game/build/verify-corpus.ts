import { matchFunction } from "@osp/matching-core";
import {
  VERDICT_INDEX_VERSION,
  type FileRecord,
  type FileVerdict,
  type FunctionVerdict,
  type ImportIndex,
  type VerdictIndex,
} from "@osp/mgs-importer";
import { createMissionContextResolver } from "../src/features/compiler/missionContextResolver.ts";
import type { ToolchainService } from "../src/features/compiler/types.ts";
import type { UpstreamService } from "../src/features/upstream/types.ts";

/** Progress lines; the caller decides where they go. */
export interface VerifyOutput {
  log(message: string): void;
}

export interface VerifyOptions {
  /** Check only these symbols, for a quick pass over one candidate. */
  readonly symbols?: ReadonlySet<string>;
}

/** Target words by symbol, for the functions this run is checking. */
export type TargetWords = ReadonlyMap<string, readonly number[]>;

/**
 * Builds one upstream source file from its recorded context and reports what
 * each pinned function it defines proved.
 *
 * The compilation unit is the file, so every function in it is checked from a
 * single build. The build also decides which file defines a function: the
 * assembled object names them, so nothing has to search the source text.
 */
export async function verifyFile(
  file: FileRecord,
  targets: TargetWords,
  service: ToolchainService,
  upstream: UpstreamService,
): Promise<{ file: FileVerdict; functions: FunctionVerdict[] }> {
  function failed(
    outcome: Exclude<FileVerdict["outcome"], "built">,
    detail: string,
  ): { file: FileVerdict; functions: FunctionVerdict[] } {
    return {
      file: { path: file.path, outcome, definedFunctions: 0, detail },
      functions: [],
    };
  }

  if (file.includesAssembly) {
    return failed("unsupported", "the source includes assembly files");
  }

  const source = await upstream.loadC(file.reference);
  if (source.kind !== "loaded") {
    return failed("build-failed", `source ${source.kind}`);
  }

  const resolved = await createMissionContextResolver(upstream).resolve(
    { compiler: file.compiler },
    source.value,
  );
  if (resolved.kind !== "ready") {
    return failed(
      "build-failed",
      resolved.kind === "cancelled"
        ? "context cancelled"
        : `context ${resolved.kind}: ${resolved.path}`,
    );
  }

  const build = await service.build(resolved.input);
  if (build.kind !== "success") {
    return failed("build-failed", build.kind);
  }

  const { object } = build;
  const functions: FunctionVerdict[] = [];
  for (const defined of object.functions) {
    const words = targets.get(defined.name);
    if (words === undefined) continue;

    const outcome = matchFunction(object, defined.name, {
      kind: "linked",
      words,
    });
    if (outcome.kind === "function-missing") {
      functions.push({
        symbol: defined.name,
        sourcePath: file.path,
        verdict: "function-missing",
      });
    } else if (outcome.result.exact) {
      functions.push({
        symbol: defined.name,
        sourcePath: file.path,
        verdict: "exact",
      });
    } else {
      functions.push({
        symbol: defined.name,
        sourcePath: file.path,
        verdict: "mismatch",
        mismatchKinds: [
          ...new Set(outcome.result.mismatches.map((entry) => entry.kind)),
        ].sort((a, b) => a.localeCompare(b)),
      });
    }
  }

  return {
    file: {
      path: file.path,
      outcome: "built",
      definedFunctions: object.functions.length,
    },
    functions,
  };
}

/** Loads the target words of every function this run checks. */
export async function loadTargets(
  index: ImportIndex,
  upstream: UpstreamService,
  options: VerifyOptions,
): Promise<Map<string, readonly number[]>> {
  const words = new Map<string, readonly number[]>();
  for (const record of index.functions) {
    if (record.pinned === undefined) continue;
    if (options.symbols !== undefined && !options.symbols.has(record.symbol)) {
      continue;
    }
    const outcome = await upstream.loadTarget(record.pinned.target);
    if (outcome.kind === "loaded") words.set(record.symbol, outcome.value);
  }
  return words;
}

/**
 * Reruns the real-function proof over every pinned candidate.
 *
 * A candidate becomes a corpus entry only once its known upstream source,
 * built with its recorded flags and headers, reproduces its target words
 * exactly. Nothing here logs upstream words or C.
 */
export async function verifyCorpus(
  index: ImportIndex,
  service: ToolchainService,
  upstream: UpstreamService,
  output: VerifyOutput,
  options: VerifyOptions = {},
): Promise<VerdictIndex> {
  const targets = await loadTargets(index, upstream, options);
  output.log(`loaded ${String(targets.size)} target word lists`);

  const files: FileVerdict[] = [];
  const functions: FunctionVerdict[] = [];
  const seen = new Set<string>();

  for (const [built, file] of index.files.entries()) {
    const result = await verifyFile(file, targets, service, upstream);
    files.push(result.file);
    for (const entry of result.functions) {
      functions.push(entry);
      seen.add(entry.symbol);
    }
    if ((built + 1) % 50 === 0) {
      output.log(
        `built ${String(built + 1)} of ${String(index.files.length)} source files`,
      );
    }
  }

  for (const symbol of targets.keys()) {
    if (seen.has(symbol)) continue;
    functions.push({
      symbol,
      sourcePath: "",
      verdict: "function-missing",
      detail: "no built source file defines it",
    });
  }

  return {
    schemaVersion: VERDICT_INDEX_VERSION,
    importerVersion: index.importerVersion,
    upstreamCommit: index.upstreamCommit,
    sdkCommit: index.sdkCommit,
    files: files.toSorted((a, b) => a.path.localeCompare(b.path)),
    functions: markAmbiguous(functions).toSorted((a, b) =>
      a.symbol.localeCompare(b.symbol),
    ),
  };
}

/**
 * Demotes every verdict for a symbol that more than one built source file
 * defines.
 *
 * Such a symbol cannot be pinned: a pointer records the symbol, so nothing in
 * it would say which definition a mission means, and the two need not compile
 * to the same words.
 */
export function markAmbiguous(
  functions: readonly FunctionVerdict[],
): FunctionVerdict[] {
  const definitions = new Map<string, number>();
  for (const entry of functions) {
    if (entry.sourcePath === "") continue;
    definitions.set(entry.symbol, (definitions.get(entry.symbol) ?? 0) + 1);
  }
  return functions.map((entry) => {
    const count = definitions.get(entry.symbol) ?? 0;
    return count > 1
      ? {
          symbol: entry.symbol,
          sourcePath: entry.sourcePath,
          verdict: "ambiguous",
          detail: `${String(count)} source files define it`,
        }
      : entry;
  });
}

import {
  CORPUS_SCHEMA_VERSION,
  MISSION_SCHEMA_VERSION,
  PointerCorpusSchema,
  type Mission,
  type PointerCorpus,
} from "@osp/mission-schema";
import { difficultyOf } from "./analysis.ts";
import type { MissionOverride } from "./overrides.ts";
import type {
  FileRecord,
  FunctionRecord,
  ImportIndex,
  VerdictIndex,
} from "./records.ts";

/**
 * Builds one real mission from its reviewed override and the pointer data
 * imported for its function.
 *
 * Every mechanical field comes from the import; every field a player reads
 * comes from the override. A real mission carries no known solution: its
 * answer lives upstream and is fetched only at the hint stages that reveal it.
 */
export function buildMission(
  override: MissionOverride,
  record: FunctionRecord,
  file: FileRecord,
): Mission {
  if (record.pinned === undefined) {
    throw new Error(`${override.symbol} has no pinned target.`);
  }
  const { target, facts } = record.pinned;
  return {
    schemaVersion: MISSION_SCHEMA_VERSION,
    id: override.id,
    title: override.title,
    phase: override.phase,
    kind: override.kind,
    source: {
      kind: "mgs-reversing",
      repository: "FoxdieTeam/mgs_reversing",
      build: "default",
      overlay: file.overlay,
      symbol: override.symbol,
      address: record.address,
      sourcePath: file.path,
    },
    requires: [...override.requires],
    teaches: [],
    practices: [...override.practices],
    scaffold: override.scaffold,
    completion: "exact",
    compiler: file.compiler,
    briefing: override.briefing,
    ...(override.contextTypes === undefined
      ? {}
      : { contextTypes: [...override.contextTypes] }),
    ...(override.terms === undefined ? {} : { terms: [...override.terms] }),
    starterSource: override.starterSource,
    symbol: override.symbol,
    target,
    hints: [...override.hints],
    difficulty: difficultyOf(facts, headerCount(file)),
  };
}

/** How much context a mission's compilation unit needs. */
function headerCount(file: FileRecord): number {
  const headers = file.compiler.remoteHeaders;
  return headers === undefined ? 0 : Object.keys(headers).length;
}

/**
 * Assembles the committed corpus from the import, the reproduction verdicts,
 * and the reviewed overrides.
 *
 * A reviewed mission whose candidate has gone, or whose function no longer
 * reproduces its target exactly, fails the build rather than disappearing
 * from the corpus: a silent drop would take a shipped mission away with no
 * one deciding to.
 */
export function buildCorpus(
  index: ImportIndex,
  verdicts: VerdictIndex,
  overrides: readonly MissionOverride[],
): PointerCorpus {
  if (
    verdicts.upstreamCommit !== index.upstreamCommit ||
    verdicts.sdkCommit !== index.sdkCommit
  ) {
    throw new Error(
      "The verdicts were produced from different commits than the import. Run pnpm corpus:verify again.",
    );
  }

  const records = new Map(
    index.functions.map((entry) => [entry.symbol, entry]),
  );
  const files = new Map(index.files.map((entry) => [entry.path, entry]));
  const byVerdict = new Map(
    verdicts.functions.map((entry) => [entry.symbol, entry]),
  );

  const missions = overrides
    .toSorted((a, b) => a.id.localeCompare(b.id))
    .map((override) => {
      const record = records.get(override.symbol);
      const verdict = byVerdict.get(override.symbol);
      if (record === undefined || verdict === undefined) {
        throw new Error(
          `${override.symbol} is reviewed but was not imported from this checkout. Remove it from the overrides or repin the corpus.`,
        );
      }
      if (verdict.verdict !== "exact") {
        throw new Error(
          `${override.symbol} is reviewed but its verdict is "${verdict.verdict}". A mission ships only when its known source reproduces its target exactly.`,
        );
      }
      const file = files.get(verdict.sourcePath);
      if (file === undefined) {
        throw new Error(
          `${override.symbol} verified from ${verdict.sourcePath}, which the import does not describe.`,
        );
      }
      return buildMission(override, record, file);
    });

  const corpus: PointerCorpus = {
    schemaVersion: CORPUS_SCHEMA_VERSION,
    importerVersion: index.importerVersion,
    upstreamCommit: index.upstreamCommit,
    sdkCommit: index.sdkCommit,
    missions,
  };

  const parsed = PointerCorpusSchema.safeParse(corpus);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`The corpus is not valid:\n${issues}`);
  }
  return corpus;
}

/** Whether a rebuild would leave the committed corpus unchanged. */
export function sameCorpus(a: PointerCorpus, b: PointerCorpus): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Where the generated corpus module lives, relative to the repository root. */
export const CORPUS_MODULE_PATH = "packages/curriculum/src/real/corpus.ts";

/** Renders the generated corpus module. */
export function renderCorpusModule(corpus: PointerCorpus): string {
  return [
    "// Generated by `pnpm corpus:write` from pinned upstream checkouts.",
    "// Do not edit. Edit the reviewed overrides and regenerate.",
    'import type { PointerCorpus } from "@osp/mission-schema";',
    "",
    `export const pointerCorpus: PointerCorpus = ${JSON.stringify(corpus)};`,
    "",
  ].join("\n");
}

export {
  difficultyOf,
  featureTags,
  functionFacts,
  phaseZeroToFourCandidate,
  FEATURE_TAGS,
  type FeatureTag,
  type FunctionFacts,
} from "./analysis.ts";
export {
  readImportIndex,
  readModuleText,
  readOverrides,
  readVerdictIndex,
  renderJson,
  writeModule,
  reviewReportPath,
  updateReportPath,
  writeImportIndex,
  writeUpdateReport,
  writeReviewReport,
  writeVerdictIndex,
  IMPORT_INDEX_PATH,
  VERDICT_INDEX_PATH,
  type Root,
} from "./artifacts.ts";
export {
  gpSizeFor,
  isExcludedSource,
  overlayFor,
  EXCLUDED_DIRECTORIES,
  GLOBAL_SIZE_PATHS,
} from "./buildRules.ts";
export {
  checkoutsFromEnvironment,
  createGitReader,
  parseDeletions,
  type GitDeletion,
  type GitReader,
  type LocalCheckouts,
} from "./checkout.ts";
export {
  runImportCommand,
  runUpdateCommand,
  runWriteCommand,
  MISSING_CHECKOUTS,
  type CommandOutput,
  type FormatModule,
} from "./cli.ts";
export {
  checkPointers,
  diffImports,
  renderUpdateReport,
  type FunctionChange,
  type UnresolvedPointer,
  type UpdateReport,
} from "./update.ts";
export {
  buildCorpus,
  buildMission,
  renderCorpusModule,
  sameCorpus,
  CORPUS_MODULE_PATH,
} from "./corpus.ts";
export {
  parseOverrides,
  MissionOverrideSchema,
  MissionOverridesSchema,
  OVERRIDES_PATH,
  OVERRIDES_SCHEMA_VERSION,
  type MissionOverride,
  type MissionOverrides,
} from "./overrides.ts";
export {
  CORPUS_CONFIG,
  FUNCTIONS_PATH,
  REPORT_DIRECTORY,
  type CorpusConfig,
} from "./config.ts";
export { sha256Hex, wordsSha256 } from "./hash.ts";
export { deletionsByName, newestDeletion, type Deletion } from "./history.ts";
export {
  directoryOf,
  includeClosure,
  includeDirectives,
  normalizePath,
  upstreamFileOf,
  type ClosureEntry,
  type ReadUpstream,
} from "./includes.ts";
export {
  compilerSettingsFor,
  createUpstreamReader,
  importFiles,
  importFunctions,
  importTarget,
  runImport,
  type ImportOutput,
  type ImportReaders,
} from "./importer.ts";
export {
  isDefaultBuildSource,
  variantOnlySources,
  LINKER_COMMAND_PATH,
} from "./linkerCommands.ts";
export {
  assemblyNames,
  basenameOf,
  parseInventory,
  statusOf,
  type ImportStatus,
  type InventoryEntry,
} from "./inventory.ts";
export {
  IMPORT_INDEX_VERSION,
  VERDICT_INDEX_VERSION,
  type FileRecord,
  type FileVerdict,
  type FunctionRecord,
  type FunctionRejection,
  type FunctionVerdict,
  type ImportIndex,
  type Verdict,
  type VerdictIndex,
} from "./records.ts";
export { renderReviewReport } from "./report.ts";
export { buildTarget, extractDwWords, type TargetOutcome } from "./target.ts";

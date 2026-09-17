import { phaseZeroToFourCandidate } from "./analysis.ts";
import type {
  FileRecord,
  FunctionRecord,
  ImportIndex,
  VerdictIndex,
} from "./records.ts";

/**
 * The reviewer's view of one import.
 *
 * It names functions, paths, commits, and counts. It quotes no upstream C and
 * lists no target words: the report is a working file in an ignored
 * directory, and keeping it free of content keeps it safe to paste into an
 * issue or a pull request.
 *
 * `usedSymbols` names functions that already back a reviewed mission, so the
 * shortlist offers only new ones.
 */
export function renderReviewReport(
  index: ImportIndex,
  verdicts?: VerdictIndex,
  usedSymbols: ReadonlySet<string> = new Set(),
): string {
  const solved = index.functions.filter((entry) => entry.status === "SOLVED");
  const pinned = solved.flatMap((entry) =>
    entry.pinned === undefined
      ? []
      : [{ symbol: entry.symbol, ...entry.pinned }],
  );
  const lines: string[] = [
    "# Real-mission pointer review",
    "",
    `- importer: ${index.importerVersion}`,
    `- mgs_reversing: ${index.upstreamCommit}`,
    `- psyq_sdk: ${index.sdkCommit}`,
    `- source files with resolved context: ${String(index.files.length)}`,
    `- functions in the inventory: ${String(index.functions.length)}`,
    `- solved: ${String(solved.length)}, with a pinned target: ${String(pinned.length)}`,
    "",
    "## Pointers that could not be pinned",
    "",
  ];

  const byReason = new Map<string, FunctionRecord[]>();
  for (const entry of index.functions) {
    if (entry.rejection === undefined) continue;
    const bucket = byReason.get(entry.rejection.reason) ?? [];
    bucket.push(entry);
    byReason.set(entry.rejection.reason, bucket);
  }
  if (byReason.size === 0) {
    lines.push("None.", "");
  } else {
    for (const [reason, entries] of [...byReason].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      lines.push(`### ${reason} (${String(entries.length)})`, "");
      for (const entry of entries.slice(0, REASON_LIMIT)) {
        lines.push(`- ${entry.symbol}${detailOf(entry)}`);
      }
      if (entries.length > REASON_LIMIT) {
        lines.push(`- … and ${String(entries.length - REASON_LIMIT)} more`);
      }
      lines.push("");
    }
  }

  lines.push("## Smallest pinned candidates", "");
  const smallest = pinned
    .toSorted((a, b) => a.facts.words - b.facts.words)
    .slice(0, CANDIDATE_LIMIT);
  lines.push(
    "| symbol | words | branches | calls | tags |",
    "| --- | --- | --- | --- | --- |",
  );
  for (const { symbol, facts, tags } of smallest) {
    lines.push(
      `| ${symbol} | ${String(facts.words)} | ${String(facts.branches)} | ${String(facts.calls)} | ${tags.join(", ")} |`,
    );
  }
  lines.push("");

  if (verdicts !== undefined) {
    lines.push(...renderVerdicts(index, verdicts, usedSymbols));
  }

  return lines.join("\n");
}

const REASON_LIMIT = 20;
const CANDIDATE_LIMIT = 40;

function detailOf(entry: FunctionRecord): string {
  const detail = entry.rejection?.detail;
  return detail === undefined ? "" : ` — ${detail}`;
}

function renderVerdicts(
  index: ImportIndex,
  verdicts: VerdictIndex,
  usedSymbols: ReadonlySet<string>,
): string[] {
  const counts = new Map<string, number>();
  for (const entry of verdicts.functions) {
    counts.set(entry.verdict, (counts.get(entry.verdict) ?? 0) + 1);
  }
  const lines = ["## Reproduction verdicts", ""];
  for (const [verdict, count] of [...counts].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    lines.push(`- ${verdict}: ${String(count)}`);
  }

  const pinned = new Map(
    index.functions.flatMap((entry) =>
      entry.pinned === undefined ? [] : [[entry.symbol, entry.pinned] as const],
    ),
  );
  const files = new Map(index.files.map((file) => [file.path, file]));
  const exact = verdicts.functions
    .filter((entry) => entry.verdict === "exact")
    .map((entry) => ({ ...entry, pinned: pinned.get(entry.symbol) }))
    .toSorted(
      (a, b) =>
        wordsOf(a.pinned) - wordsOf(b.pinned) ||
        a.symbol.localeCompare(b.symbol),
    );

  lines.push("", "### Exact candidates, smallest first", "");
  for (const entry of exact.slice(0, CANDIDATE_LIMIT)) {
    lines.push(`- ${entry.symbol} — ${entry.sourcePath}`);
  }
  if (exact.length > CANDIDATE_LIMIT) {
    lines.push(`- … and ${String(exact.length - CANDIDATE_LIMIT)} more`);
  }

  lines.push(
    "",
    "## Phase 0–4 shortlist (call-free, branch-free, exact)",
    "",
    "Exact functions with no calls, branches, loops, stack frame, coprocessor, multiply or divide, assembler temporary, narrow stores, or global storage, not already used by a reviewed mission. The arg base column counts the loads and stores reached through an argument register; the rest of a function's accesses follow a pointer it loaded.",
    "",
  );
  const shortlist = exact
    .flatMap((entry) =>
      entry.pinned !== undefined &&
      !usedSymbols.has(entry.symbol) &&
      phaseZeroToFourCandidate(entry.pinned.facts)
        ? [{ ...entry, facts: entry.pinned.facts }]
        : [],
    )
    .slice(0, CANDIDATE_LIMIT);
  if (shortlist.length === 0) {
    lines.push("None.");
  } else {
    lines.push(
      "| symbol | words | loads | stores | narrow loads | arg base | gpSize | headers | source path |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const { symbol, facts, sourcePath } of shortlist) {
      const file = files.get(sourcePath);
      lines.push(
        `| ${symbol} | ${String(facts.words)} | ${String(facts.loads)} | ${String(facts.stores)} | ${String(facts.narrowLoads)} | ${String(facts.argumentBaseAccesses)} | ${gpSizeOf(file)} | ${headersOf(file)} | ${sourcePath} |`,
      );
    }
  }
  lines.push("");
  return lines;
}

/** Candidates without a pinned target sort last. */
function wordsOf(
  pinned: { readonly facts: { readonly words: number } } | undefined,
): number {
  return pinned?.facts.words ?? Number.POSITIVE_INFINITY;
}

function gpSizeOf(file: FileRecord | undefined): string {
  return file === undefined ? "?" : String(file.compiler.gpSize);
}

function headersOf(file: FileRecord | undefined): string {
  const headers = file?.compiler.remoteHeaders;
  return file === undefined
    ? "?"
    : String(headers === undefined ? 0 : Object.keys(headers).length);
}

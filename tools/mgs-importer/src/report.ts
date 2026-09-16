import type { FunctionRecord, ImportIndex, VerdictIndex } from "./records.ts";

/**
 * The reviewer's view of one import.
 *
 * It names functions, paths, commits, and counts. It quotes no upstream C and
 * lists no target words: the report is a working file in an ignored
 * directory, and keeping it free of content keeps it safe to paste into an
 * issue or a pull request.
 */
export function renderReviewReport(
  index: ImportIndex,
  verdicts?: VerdictIndex,
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
    lines.push(...renderVerdicts(verdicts));
  }

  return lines.join("\n");
}

const REASON_LIMIT = 20;
const CANDIDATE_LIMIT = 40;

function detailOf(entry: FunctionRecord): string {
  const detail = entry.rejection?.detail;
  return detail === undefined ? "" : ` — ${detail}`;
}

function renderVerdicts(verdicts: VerdictIndex): string[] {
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
  lines.push("", "### Exact candidates, smallest first", "");
  const exact = verdicts.functions.filter((entry) => entry.verdict === "exact");
  for (const entry of exact.slice(0, CANDIDATE_LIMIT)) {
    lines.push(`- ${entry.symbol} — ${entry.sourcePath}`);
  }
  if (exact.length > CANDIDATE_LIMIT) {
    lines.push(`- … and ${String(exact.length - CANDIDATE_LIMIT)} more`);
  }
  lines.push("");
  return lines;
}

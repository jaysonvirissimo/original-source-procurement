import type { PointerCorpus } from "@osp/mission-schema";
import { sha256Hex } from "./hash.ts";
import type { ReadUpstream } from "./includes.ts";
import type { FunctionRecord, ImportIndex } from "./records.ts";

/** How one function differs between two imports. */
export interface FunctionChange {
  readonly symbol: string;
  readonly kind:
    | "added"
    | "removed"
    | "status-changed"
    | "newly-matched"
    | "target-changed"
    | "target-lost";
  readonly detail?: string;
}

/** A committed mission whose pointers no longer resolve upstream. */
export interface UnresolvedPointer {
  readonly missionId: string;
  readonly symbol: string;
  readonly path: string;
  readonly reason: "absent" | "content-changed";
}

export interface UpdateReport {
  readonly fromCommit: string;
  readonly toCommit: string;
  readonly functions: readonly FunctionChange[];
  readonly unresolved: readonly UnresolvedPointer[];
  readonly sourceFiles: { readonly added: number; readonly removed: number };
}

function targetOf(record: FunctionRecord): string | undefined {
  return record.pinned?.target.wordsSha256;
}

/**
 * What changed between two imports of the same repository.
 *
 * The comparison is by symbol, because that is what a pointer records. A
 * function upstream renamed therefore reads as one removal and one addition:
 * nothing in the two imports ties the old name to the new one, and a reviewer
 * has to decide whether they are the same function anyway.
 */
export function diffImports(
  before: ImportIndex,
  after: ImportIndex,
): UpdateReport {
  const previous = new Map(
    before.functions.map((entry) => [entry.symbol, entry]),
  );
  const current = new Map(
    after.functions.map((entry) => [entry.symbol, entry]),
  );
  const changes: FunctionChange[] = [];

  for (const [symbol, entry] of current) {
    const was = previous.get(symbol);
    if (was === undefined) {
      changes.push({ symbol, kind: "added", detail: entry.status });
      continue;
    }
    if (was.status !== entry.status) {
      changes.push({
        symbol,
        kind: entry.status === "SOLVED" ? "newly-matched" : "status-changed",
        detail: `${was.status} to ${entry.status}`,
      });
      continue;
    }
    const before_ = targetOf(was);
    const after_ = targetOf(entry);
    if (before_ !== undefined && after_ === undefined) {
      const reason = entry.rejection?.reason;
      changes.push(
        reason === undefined
          ? { symbol, kind: "target-lost" }
          : { symbol, kind: "target-lost", detail: reason },
      );
    } else if (
      before_ !== undefined &&
      after_ !== undefined &&
      before_ !== after_
    ) {
      changes.push({ symbol, kind: "target-changed" });
    }
  }

  for (const symbol of previous.keys()) {
    if (!current.has(symbol)) changes.push({ symbol, kind: "removed" });
  }

  const beforePaths = new Set(before.files.map((file) => file.path));
  const afterPaths = new Set(after.files.map((file) => file.path));

  return {
    fromCommit: before.upstreamCommit,
    toCommit: after.upstreamCommit,
    functions: changes.toSorted(
      (a, b) =>
        a.kind.localeCompare(b.kind) || a.symbol.localeCompare(b.symbol),
    ),
    unresolved: [],
    sourceFiles: {
      added: [...afterPaths].filter((path) => !beforePaths.has(path)).length,
      removed: [...beforePaths].filter((path) => !afterPaths.has(path)).length,
    },
  };
}

/**
 * Checks that every file a shipped mission points at is still there and still
 * hashes to what the corpus recorded.
 *
 * A target is pinned to a historical commit and so should never move; a
 * context header is pinned to the corpus commit and does move when the corpus
 * is repinned. Either way, a pointer that no longer resolves is a mission
 * that would fail to load for a player.
 */
export async function checkPointers(
  corpus: PointerCorpus,
  read: ReadUpstream,
): Promise<UnresolvedPointer[]> {
  const unresolved: UnresolvedPointer[] = [];

  for (const mission of corpus.missions) {
    const check = async (
      path: string,
      expected: string | undefined,
      repository: "FoxdieTeam/mgs_reversing" | "FoxdieTeam/psyq_sdk",
    ) => {
      const bytes = await read(repository, path);
      if (bytes === undefined) {
        unresolved.push({
          missionId: mission.id,
          symbol: mission.symbol,
          path,
          reason: "absent",
        });
        return;
      }
      if (expected !== undefined && sha256Hex(bytes) !== expected) {
        unresolved.push({
          missionId: mission.id,
          symbol: mission.symbol,
          path,
          reason: "content-changed",
        });
      }
    };

    if (mission.target.kind === "remote") {
      await check(mission.target.path, undefined, "FoxdieTeam/mgs_reversing");
    }
    for (const reference of Object.values(
      mission.compiler.remoteHeaders ?? {},
    )) {
      await check(reference.path, reference.sha256, reference.repository);
    }
  }

  return unresolved;
}

/** The reviewer's view of one corpus update. */
export function renderUpdateReport(report: UpdateReport): string {
  const lines = [
    "# Corpus update",
    "",
    `- from: ${report.fromCommit}`,
    `- to: ${report.toCommit}`,
    `- source files added: ${String(report.sourceFiles.added)}, removed: ${String(report.sourceFiles.removed)}`,
    "",
  ];

  const byKind = new Map<string, FunctionChange[]>();
  for (const change of report.functions) {
    const bucket = byKind.get(change.kind) ?? [];
    bucket.push(change);
    byKind.set(change.kind, bucket);
  }

  lines.push("## Functions", "");
  if (byKind.size === 0) {
    lines.push("No change.", "");
  } else {
    for (const [kind, changes] of [...byKind].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      lines.push(`### ${kind} (${String(changes.length)})`, "");
      for (const change of changes.slice(0, CHANGE_LIMIT)) {
        lines.push(
          `- ${change.symbol}${change.detail === undefined ? "" : ` — ${change.detail}`}`,
        );
      }
      if (changes.length > CHANGE_LIMIT) {
        lines.push(`- … and ${String(changes.length - CHANGE_LIMIT)} more`);
      }
      lines.push("");
    }
  }

  lines.push("## Shipped pointers that no longer resolve", "");
  if (report.unresolved.length === 0) {
    lines.push("None.", "");
  } else {
    for (const entry of report.unresolved) {
      lines.push(
        `- ${entry.missionId} (${entry.symbol}): ${entry.path} — ${entry.reason}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

const CHANGE_LIMIT = 30;

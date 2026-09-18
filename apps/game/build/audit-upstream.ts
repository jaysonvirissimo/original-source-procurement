import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { promisify } from "node:util";
import type {
  FeasibilityPointer,
  Mission,
  RemoteCReference,
  RemoteTarget,
} from "@osp/mission-schema";

const run = promisify(execFile);

export interface UpstreamAuditIssue {
  readonly code:
    "target-file" | "target-line" | "upstream-file" | "target-words";
  readonly path: string;
  readonly message: string;
}

/** What committed or built files are checked against. */
export interface UpstreamFingerprints {
  /** SHA-256 of every referenced upstream file's original bytes. */
  readonly fileHashes: ReadonlySet<string>;
  /** Every referenced target's word count and little-endian words hash. */
  readonly targets: readonly Pick<RemoteTarget, "wordCount" | "wordsSha256">[];
}

export function sha256Hex(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Collects the hashes of every upstream file and target the data points to. */
export function fingerprintsOf(
  pointers: readonly FeasibilityPointer[],
  missions: readonly Mission[],
): UpstreamFingerprints {
  const references: RemoteCReference[] = [];
  const targets: RemoteTarget[] = [];
  for (const pointer of pointers) {
    references.push(
      pointer.solution,
      ...Object.values(pointer.compiler.remoteHeaders ?? {}),
    );
    targets.push(pointer.target);
  }
  for (const mission of missions) {
    references.push(...Object.values(mission.compiler.remoteHeaders ?? {}));
    for (const hint of mission.hints) {
      if (hint.reveal !== undefined) {
        references.push(hint.reveal);
      }
    }
    if (mission.target.kind === "remote") {
      targets.push(mission.target);
    }
  }
  return {
    fileHashes: new Set(references.map((reference) => reference.sha256)),
    targets: targets.map(({ wordCount, wordsSha256 }) => ({
      wordCount,
      wordsSha256,
    })),
  };
}

const TARGET_PATH = /(^|\/)asm\/.+\.s$/;
const TARGET_LINE = /^[ \t]*dw[ \t]+0x[0-9A-Fa-f]{8}\b/m;
const NUMBER = /\b(?:0[xX][0-9A-Fa-f]{1,8}|\d{1,10})\b/g;

/** UTF-8 text, or `undefined` for binary content. */
function decodeText(bytes: Uint8Array): string | undefined {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return text.includes("\0") ? undefined : text;
  } catch {
    return undefined;
  }
}

function littleEndian(values: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => {
    view.setUint32(index * 4, value, true);
  });
  return bytes;
}

/** Every 32-bit numeric literal in a text, in order, as little-endian words. */
function numbersIn(text: string): Uint8Array {
  return littleEndian(
    (text.match(NUMBER) ?? [])
      .map((literal) =>
        /^0x/i.test(literal)
          ? Number.parseInt(literal.slice(2), 16)
          : Number(literal),
      )
      .filter((value) => value <= 0xffff_ffff),
  );
}

function containsTargetRun(
  words: Uint8Array,
  targets: UpstreamFingerprints["targets"],
): boolean {
  const hashesByCount = new Map<number, Set<string>>();
  for (const { wordCount, wordsSha256 } of targets) {
    const hashes = hashesByCount.get(wordCount) ?? new Set<string>();
    hashes.add(wordsSha256);
    hashesByCount.set(wordCount, hashes);
  }
  const total = Math.floor(words.length / 4);
  for (const [count, hashes] of hashesByCount) {
    for (let start = 0; start + count <= total; start += 1) {
      const run = words.subarray(start * 4, (start + count) * 4);
      if (hashes.has(sha256Hex(run))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks one file for upstream content that can be detected mechanically: an
 * upstream target file, a `dw 0x` target line, a whole referenced upstream
 * file as-is or after converting its line endings to LF or CRLF, and a
 * complete run of a referenced target's words, as numbers in text or as
 * aligned little-endian words in binary content.
 *
 * It cannot detect excerpts or rewritten code; maintainer review covers those.
 */
export function auditFile(
  path: string,
  bytes: Uint8Array,
  fingerprints: UpstreamFingerprints,
): UpstreamAuditIssue[] {
  const issues: UpstreamAuditIssue[] = [];
  const report = (code: UpstreamAuditIssue["code"], message: string) => {
    issues.push({ code, path, message });
  };

  if (TARGET_PATH.test(path)) {
    report(
      "target-file",
      "An upstream target file is never committed or built.",
    );
  }

  const text = decodeText(bytes);
  const encoder = new TextEncoder();
  const lf = text?.replaceAll("\r\n", "\n");
  const variants =
    lf === undefined
      ? [bytes]
      : [
          bytes,
          encoder.encode(lf),
          encoder.encode(lf.replaceAll("\n", "\r\n")),
        ];
  if (
    variants.some((variant) => fingerprints.fileHashes.has(sha256Hex(variant)))
  ) {
    report(
      "upstream-file",
      "Matches a referenced upstream file, as-is or after converting its line endings.",
    );
  }

  if (text !== undefined && TARGET_LINE.test(text)) {
    report("target-line", "Contains a dw 0x target line.");
  }

  const words =
    text === undefined
      ? bytes.subarray(0, bytes.length - (bytes.length % 4))
      : numbersIn(text);
  if (containsTargetRun(words, fingerprints.targets)) {
    report(
      "target-words",
      "Contains a run of 32-bit words matching a referenced upstream target.",
    );
  }

  return issues;
}

/** Files git tracks in a repository, relative to its root. */
export async function listTrackedFiles(
  repositoryRoot: string,
): Promise<string[]> {
  const { stdout } = await run(
    "git",
    ["-C", repositoryRoot, "ls-files", "-z"],
    {
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  return stdout.split("\0").filter((path) => path !== "");
}

async function listSiteFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      relative(directory, join(entry.parentPath, entry.name))
        .split(sep)
        .join("/"),
    )
    .sort();
}

export interface UpstreamAuditOptions {
  readonly repositoryRoot: string;
  readonly siteDirectory: string;
  readonly fingerprints: UpstreamFingerprints;
  /** Fail when the site directory is missing instead of auditing tracked files only. */
  readonly requireSite?: boolean;
  readonly listTracked?: (repositoryRoot: string) => Promise<string[]>;
}

export interface AuditOutput {
  log(line: string): void;
  error(line: string): void;
}

/**
 * Audits every tracked file and the built site, prints the outcome, and
 * returns an exit code. A missing site is an error when `requireSite` is set,
 * so a gate that names the site never passes by auditing tracked files only;
 * otherwise the audit says the site was skipped and checks tracked files.
 */
export async function runUpstreamAudit(
  options: UpstreamAuditOptions,
  output: AuditOutput,
): Promise<number> {
  const { repositoryRoot, siteDirectory, fingerprints, requireSite } = options;
  const listTracked = options.listTracked ?? listTrackedFiles;

  let files: [label: string, location: string][];
  try {
    files = (await listTracked(repositoryRoot)).map((path) => [
      path,
      join(repositoryRoot, path),
    ]);
  } catch {
    output.error(`Could not list tracked files in ${repositoryRoot}.`);
    return 1;
  }
  try {
    for (const path of await listSiteFiles(siteDirectory)) {
      files.push([`${siteDirectory}/${path}`, join(siteDirectory, path)]);
    }
  } catch {
    if (requireSite === true) {
      output.error(
        `No built site at ${siteDirectory}. Run pnpm build before the upstream audit.`,
      );
      return 1;
    }
    output.log(
      `No built site at ${siteDirectory}; only tracked files were checked.`,
    );
  }

  const issues: UpstreamAuditIssue[] = [];
  let checked = 0;
  for (const [label, location] of files) {
    let bytes: Uint8Array;
    try {
      bytes = await readFile(location);
    } catch {
      // A tracked file deleted from the working tree has nothing to check.
      continue;
    }
    checked += 1;
    issues.push(...auditFile(label, bytes, fingerprints));
  }

  if (issues.length === 0) {
    output.log(
      `Upstream audit passed: checked ${String(checked)} files against ${String(fingerprints.fileHashes.size)} upstream file hashes and ${String(fingerprints.targets.length)} target word hashes.`,
    );
    return 0;
  }

  for (const issue of issues) {
    output.error(`${issue.path}: ${issue.message} [${issue.code}]`);
  }
  const noun = issues.length === 1 ? "issue" : "issues";
  output.error(`Upstream audit failed with ${String(issues.length)} ${noun}.`);
  return 1;
}

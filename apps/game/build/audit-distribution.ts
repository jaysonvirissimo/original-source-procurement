import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import type { PsyqWasmRelease } from "./psyq-wasm-release.ts";

export interface AuditIssue {
  readonly code:
    | "missing-file"
    | "hash-mismatch"
    | "notices-incomplete"
    | "transformed-artifact"
    | "duplicate-artifact";
  readonly path: string;
  readonly message: string;
}

export interface AuditExpectations {
  readonly release: PsyqWasmRelease;
  /** The notices file, relative to the site root. */
  readonly noticesFile: string;
  /**
   * Text the notices must contain, such as package headings and license
   * texts. Artifact hashes and the source archive name are always required.
   */
  readonly noticeText: readonly string[];
}

const RECORDS = [
  "PROVENANCE.md",
  "SHA256SUMS",
  "build-info.json",
  "LICENSE",
  "LICENSES/GPL-2.0-only.txt",
];
const SCRIPT_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".html"]);

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function listFiles(directory: string): Promise<string[]> {
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

/**
 * Checks that a built site may distribute psyq-wasm's GPL-2.0-only compiler
 * artifacts: it carries complete notices, ships each artifact byte-for-byte
 * with its provenance records, publishes the corresponding source, and holds
 * no other copy of an artifact, modified or not.
 *
 * This is a distribution check, not legal review.
 */
export async function auditDistribution(
  siteDirectory: string,
  expectations: AuditExpectations,
): Promise<AuditIssue[]> {
  const { release, noticesFile } = expectations;
  const vendor = release.vendorDirectory;
  const files = await listFiles(siteDirectory);
  const present = new Set(files);
  const read = (path: string) => readFile(join(siteDirectory, path));
  const issues: AuditIssue[] = [];
  const missing = (path: string, what: string) => {
    issues.push({
      code: "missing-file",
      path,
      message: `The site is missing ${what}.`,
    });
  };

  if (present.has(noticesFile)) {
    const notices = (await read(noticesFile)).toString("utf8");
    const required = [
      ...expectations.noticeText,
      ...Object.values(release.artifacts),
      release.sourceArchive.fileName,
    ];
    for (const text of required) {
      if (!notices.includes(text)) {
        issues.push({
          code: "notices-incomplete",
          path: noticesFile,
          message: `The notices do not contain ${JSON.stringify(text)}.`,
        });
      }
    }
  } else {
    missing(noticesFile, "its third-party notices");
  }

  const pinned: [string, string, string][] = [
    ...Object.entries(release.artifacts).map(
      ([name, hash]): [string, string, string] => [
        name,
        hash,
        "a compiler artifact",
      ],
    ),
    [
      release.sourceArchive.fileName,
      release.sourceArchive.sha256,
      "the corresponding-source archive",
    ],
  ];
  for (const [name, expected, what] of pinned) {
    const path = `${vendor}/${name}`;
    if (!present.has(path)) {
      missing(path, what);
      continue;
    }
    const actual = sha256Hex(await read(path));
    if (actual !== expected) {
      issues.push({
        code: "hash-mismatch",
        path,
        message: `SHA-256 is ${actual}, but psyq-wasm ${release.version} has ${expected}.`,
      });
    }
  }

  for (const name of RECORDS) {
    const path = `${vendor}/${name}`;
    if (!present.has(path)) {
      missing(path, "a license or provenance record");
    }
  }

  const verbatim = new Set(
    Object.keys(release.artifacts).map((name) => `${vendor}/${name}`),
  );
  const artifactHashes = new Set(Object.values(release.artifacts));
  for (const path of files) {
    if (verbatim.has(path)) {
      continue;
    }
    const extension = extname(path);
    if (SCRIPT_EXTENSIONS.has(extension)) {
      const text = (await read(path)).toString("utf8");
      const buildId = release.buildIds.find((id) => text.includes(id));
      if (buildId !== undefined) {
        issues.push({
          code: "transformed-artifact",
          path,
          message: `Contains compiler build ID ${buildId}, so it holds a modified copy of GPL-2.0-only glue code. Ship compiler artifacts only as verbatim files under ${vendor}/.`,
        });
      }
    } else if (
      extension === ".wasm" &&
      artifactHashes.has(sha256Hex(await read(path)))
    ) {
      issues.push({
        code: "duplicate-artifact",
        path,
        message: `A second copy of a compiler artifact, outside ${vendor}/.`,
      });
    }
  }

  return issues;
}

export interface AuditOutput {
  log(line: string): void;
  error(line: string): void;
}

/** Audits a built site, prints the outcome, and returns an exit code. */
export async function runDistributionAudit(
  siteDirectory: string,
  expectations: AuditExpectations,
  output: AuditOutput,
): Promise<number> {
  let issues: AuditIssue[];
  try {
    issues = await auditDistribution(siteDirectory, expectations);
  } catch {
    output.error(
      `Could not read the built site at ${siteDirectory}. Run the build first.`,
    );
    return 1;
  }

  if (issues.length === 0) {
    output.log(
      `Distribution audit passed: ${siteDirectory} ships psyq-wasm ${expectations.release.version} with notices, provenance, and corresponding source.`,
    );
    return 0;
  }

  for (const issue of issues) {
    output.error(`${issue.path}: ${issue.message} [${issue.code}]`);
  }
  const noun = issues.length === 1 ? "issue" : "issues";
  output.error(
    `Distribution audit failed with ${String(issues.length)} ${noun}.`,
  );
  return 1;
}

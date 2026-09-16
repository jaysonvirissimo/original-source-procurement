import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Local clones of the two upstream repositories, with full history. */
export interface LocalCheckouts {
  readonly mgsReversing: string;
  readonly psyqSdk: string;
}

/**
 * Checkout directories from `OSP_MGS_REVERSING_DIR` and `OSP_PSYQ_SDK_DIR`,
 * or `undefined` when either is unset.
 */
export function checkoutsFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): LocalCheckouts | undefined {
  const mgsReversing = env.OSP_MGS_REVERSING_DIR;
  const psyqSdk = env.OSP_PSYQ_SDK_DIR;
  return mgsReversing && psyqSdk ? { mgsReversing, psyqSdk } : undefined;
}

/**
 * The reads the importer makes of one repository. Every one of them names a
 * commit, so the checkout's working tree never affects the result.
 */
export interface GitReader {
  /** A file's original bytes at a commit, or `undefined` when it is absent. */
  blob(commit: string, path: string): Promise<Uint8Array | undefined>;
  /** Every path in the commit's tree, in git's order. */
  paths(commit: string): Promise<readonly string[]>;
  /** A revision resolved to a full hash, or `undefined` when it has none. */
  resolve(revision: string): Promise<string | undefined>;
  /**
   * Commits that deleted a path under `pathspec`, newest first, each with the
   * paths it deleted.
   */
  deletions(commit: string, pathspec: string): Promise<readonly GitDeletion[]>;
}

export interface GitDeletion {
  readonly commit: string;
  readonly paths: readonly string[];
}

const MAX_BLOB_BYTES = 16 * 1024 * 1024;
const MAX_LIST_BYTES = 64 * 1024 * 1024;

/** A `GitReader` backed by the `git` command in a checkout directory. */
export function createGitReader(directory: string): GitReader {
  async function text(
    args: readonly string[],
    maxBuffer: number,
  ): Promise<string | undefined> {
    try {
      const { stdout } = await run("git", ["-C", directory, ...args], {
        encoding: "utf8",
        maxBuffer,
      });
      return stdout;
    } catch {
      return undefined;
    }
  }

  return {
    async blob(commit, path) {
      try {
        const { stdout } = await run(
          "git",
          ["-C", directory, "cat-file", "blob", `${commit}:${path}`],
          { encoding: "buffer", maxBuffer: MAX_BLOB_BYTES },
        );
        return new Uint8Array(stdout);
      } catch {
        return undefined;
      }
    },

    async paths(commit) {
      const stdout = await text(
        ["ls-tree", "-r", "-z", "--name-only", commit],
        MAX_LIST_BYTES,
      );
      return stdout === undefined ? [] : stdout.split("\0").filter(Boolean);
    },

    async resolve(revision) {
      const stdout = await text(["rev-parse", "--verify", revision], 1024);
      const resolved = stdout?.trim();
      return resolved === undefined || resolved === "" ? undefined : resolved;
    },

    async deletions(commit, pathspec) {
      const stdout = await text(
        [
          "log",
          "--diff-filter=D",
          "--name-only",
          "--format=%x00%H",
          commit,
          "--",
          pathspec,
        ],
        MAX_LIST_BYTES,
      );
      return stdout === undefined ? [] : parseDeletions(stdout);
    },
  };
}

/**
 * `git log --name-only` output where each commit starts with a NUL: the NUL
 * separates commits unambiguously, because a path can contain a newline but
 * never a NUL.
 */
export function parseDeletions(stdout: string): GitDeletion[] {
  const deletions: GitDeletion[] = [];
  for (const entry of stdout.split("\0")) {
    const lines = entry.split("\n").filter((line) => line !== "");
    const [commit, ...paths] = lines;
    if (commit !== undefined && paths.length > 0) {
      deletions.push({ commit, paths });
    }
  }
  return deletions;
}

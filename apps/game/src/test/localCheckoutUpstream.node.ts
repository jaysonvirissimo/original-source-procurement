import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RemoteCReference } from "@osp/mission-schema";
import {
  verifyCBytes,
  verifyTargetText,
} from "../features/upstream/content.ts";
import type {
  UpstreamOutcome,
  UpstreamService,
} from "../features/upstream/types.ts";

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
 * A file's original bytes at a commit, read from git's object store so the
 * checkout's working tree does not matter, or `undefined` when it is absent.
 */
export async function readCheckoutBlob(
  checkouts: LocalCheckouts,
  repository: RemoteCReference["repository"],
  commit: string,
  path: string,
): Promise<Uint8Array | undefined> {
  const directory =
    repository === "FoxdieTeam/psyq_sdk"
      ? checkouts.psyqSdk
      : checkouts.mgsReversing;
  try {
    const { stdout } = await run(
      "git",
      ["-C", directory, "cat-file", "blob", `${commit}:${path}`],
      { encoding: "buffer", maxBuffer: 16 * 1024 * 1024 },
    );
    return new Uint8Array(stdout);
  } catch {
    return undefined;
  }
}

const UNAVAILABLE = { kind: "unavailable", attempts: [] } as const;
const MISMATCH = { kind: "content-mismatch", attempts: [] } as const;

function loaded<T>(value: T | undefined): UpstreamOutcome<T> {
  return value === undefined
    ? MISMATCH
    : { kind: "loaded", value, source: "cache" };
}

/**
 * An `UpstreamService` that reads pinned files from local checkouts instead
 * of the network, and verifies them exactly as fetched content is. Loaded
 * results report `cache` as their source, because no host was contacted.
 */
export function createLocalCheckoutUpstream(
  checkouts: LocalCheckouts,
): UpstreamService {
  return {
    async loadTarget(target) {
      const bytes = await readCheckoutBlob(
        checkouts,
        "FoxdieTeam/mgs_reversing",
        target.commit,
        target.path,
      );
      return bytes === undefined
        ? UNAVAILABLE
        : loaded(
            await verifyTargetText(new TextDecoder().decode(bytes), target),
          );
    },

    async loadC(reference) {
      const bytes = await readCheckoutBlob(
        checkouts,
        reference.repository,
        reference.commit,
        reference.path,
      );
      return bytes === undefined
        ? UNAVAILABLE
        : loaded(await verifyCBytes(bytes, reference));
    },

    async clearCache() {
      // Nothing is cached.
    },
  };
}

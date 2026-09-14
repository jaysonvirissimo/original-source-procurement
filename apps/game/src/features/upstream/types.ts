import type { RemoteCReference, RemoteTarget } from "@osp/mission-schema";

/** The only two hosts OSP fetches upstream content from. */
export type UpstreamHost = "raw.githubusercontent.com" | "cdn.jsdelivr.net";

/** One failed try against one host. */
export interface UpstreamAttempt {
  readonly host: UpstreamHost;
  readonly result:
    "network-error" | "http-status" | "timeout" | "too-large" | "hash-mismatch";
  readonly status?: number;
}

export type UpstreamOutcome<T> =
  | {
      readonly kind: "loaded";
      readonly value: T;
      readonly source: UpstreamHost | "cache";
    }
  | {
      readonly kind: "unavailable";
      readonly attempts: readonly UpstreamAttempt[];
    }
  | {
      readonly kind: "content-mismatch";
      readonly attempts: readonly UpstreamAttempt[];
    }
  | { readonly kind: "cancelled" };

/**
 * Loads pinned upstream content at runtime, verified against its recorded
 * hash. `loadC` returns C with LF line endings: the whole file, or only the
 * reference's line span when it has one.
 */
export interface UpstreamService {
  loadTarget(
    target: RemoteTarget,
    signal?: AbortSignal,
  ): Promise<UpstreamOutcome<readonly number[]>>;
  loadC(
    reference: RemoteCReference,
    signal?: AbortSignal,
  ): Promise<UpstreamOutcome<string>>;
  clearCache(): Promise<void>;
}

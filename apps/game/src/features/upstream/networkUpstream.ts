import type { RemoteCReference, RemoteTarget } from "@osp/mission-schema";
import type { UpstreamCacheStore } from "../persistence/types";
import { verifyCBytes, verifyTargetText } from "./content";
import type {
  UpstreamAttempt,
  UpstreamHost,
  UpstreamOutcome,
  UpstreamService,
} from "./types";
import { upstreamUrls } from "./urls";

/** How long one host may take to answer and send its body. */
export const UPSTREAM_TIMEOUT_MS = 15_000;

/** The largest body OSP reads from a host. */
export const UPSTREAM_MAX_BYTES = 256 * 1024;

export interface NetworkUpstreamOptions {
  readonly fetch: typeof globalThis.fetch;
  readonly cache: UpstreamCacheStore;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
}

/** The service the shipped game uses, over the browser fetch. */
export function createBrowserUpstream(
  cache: UpstreamCacheStore,
): UpstreamService {
  return createNetworkUpstream({
    fetch: (input, init) => globalThis.fetch(input, init),
    cache,
  });
}

type Fetched =
  | { readonly kind: "body"; readonly bytes: Uint8Array }
  | { readonly kind: "failed"; readonly attempt: UpstreamAttempt }
  | { readonly kind: "cancelled" };

const CANCELLED = { kind: "cancelled" } as const;

/** For cleanup whose failure changes nothing. */
const ignore = () => undefined;

/**
 * Loads pinned upstream content from raw.githubusercontent.com, then
 * jsDelivr, and keeps verified bytes in the upstream cache. Every request
 * omits credentials and carries no player data. Content is used only after
 * its hash verifies, and an entry read back from the cache is verified again.
 */
export function createNetworkUpstream({
  fetch,
  cache,
  timeoutMs = UPSTREAM_TIMEOUT_MS,
  maxBytes = UPSTREAM_MAX_BYTES,
}: NetworkUpstreamOptions): UpstreamService {
  async function fetchBytes(
    host: UpstreamHost,
    url: string,
    signal: AbortSignal | undefined,
  ): Promise<Fetched> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    const cancel = () => {
      controller.abort();
    };
    signal?.addEventListener("abort", cancel);
    const failed = (
      result: UpstreamAttempt["result"],
      status?: number,
    ): Fetched => ({
      kind: "failed",
      attempt:
        status === undefined ? { host, result } : { host, result, status },
    });
    try {
      const response = await fetch(url, {
        credentials: "omit",
        signal: controller.signal,
      });
      if (response.status !== 200) {
        void response.body?.cancel().catch(ignore);
        return failed("http-status", response.status);
      }
      const bytes = await readCapped(response, maxBytes);
      return bytes === undefined
        ? failed("too-large")
        : { kind: "body", bytes };
    } catch {
      if (signal?.aborted === true) {
        return CANCELLED;
      }
      // Only the timer aborts the request without the caller aborting.
      return failed(controller.signal.aborted ? "timeout" : "network-error");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    }
  }

  async function load<T>(
    repository: string,
    commit: string,
    path: string,
    key: string,
    verify: (bytes: Uint8Array) => Promise<T | undefined>,
    signal: AbortSignal | undefined,
  ): Promise<UpstreamOutcome<T>> {
    const urls = upstreamUrls(repository, commit, path);
    if (urls === undefined) {
      return { kind: "unavailable", attempts: [] };
    }
    const cached = await readCache(cache, key);
    if (cached !== undefined) {
      const value = await verify(cached);
      if (value !== undefined) {
        return { kind: "loaded", value, source: "cache" };
      }
    }
    const attempts: UpstreamAttempt[] = [];
    for (const { host, url } of urls) {
      if (signal?.aborted === true) {
        return CANCELLED;
      }
      const fetched = await fetchBytes(host, url, signal);
      if (fetched.kind === "cancelled") {
        return CANCELLED;
      }
      if (fetched.kind === "failed") {
        attempts.push(fetched.attempt);
        continue;
      }
      const value = await verify(fetched.bytes);
      if (value === undefined) {
        attempts.push({ host, result: "hash-mismatch" });
        continue;
      }
      // A cache that cannot be written only costs a download next time.
      await cache.put(key, fetched.bytes).catch(ignore);
      return { kind: "loaded", value, source: host };
    }
    return attempts.some((attempt) => attempt.result === "hash-mismatch")
      ? { kind: "content-mismatch", attempts }
      : { kind: "unavailable", attempts };
  }

  return {
    loadTarget: (target: RemoteTarget, signal?: AbortSignal) =>
      load(
        "FoxdieTeam/mgs_reversing",
        target.commit,
        target.path,
        target.wordsSha256,
        (bytes) => verifyTargetText(new TextDecoder().decode(bytes), target),
        signal,
      ),
    loadC: (reference: RemoteCReference, signal?: AbortSignal) =>
      load(
        reference.repository,
        reference.commit,
        reference.path,
        reference.sha256,
        (bytes) => verifyCBytes(bytes, reference),
        signal,
      ),
    clearCache: () => cache.clear(),
  };
}

/** Cached bytes, or `undefined` for a miss, a foreign value, or a failed read. */
async function readCache(
  cache: UpstreamCacheStore,
  key: string,
): Promise<Uint8Array | undefined> {
  try {
    const value = await cache.get(key);
    return ArrayBuffer.isView(value)
      ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      : undefined;
  } catch {
    return undefined;
  }
}

/** The whole body, or `undefined` once it grows past `maxBytes`. */
async function readCapped(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array | undefined> {
  const declared = Number(response.headers.get("content-length"));
  if (declared > maxBytes) {
    void response.body?.cancel().catch(ignore);
    return undefined;
  }
  if (response.body === null) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength > maxBytes ? undefined : bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel().catch(ignore);
      return undefined;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

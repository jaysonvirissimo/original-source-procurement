import { sha256Hex, wordsSha256 } from "@osp/curriculum";
import type { RemoteCReference, RemoteWords } from "@osp/mission-schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryStorage } from "../persistence/memoryPersistence";
import type { UpstreamCacheStore } from "../persistence/types";
import { createNetworkUpstream } from "./networkUpstream";

// Every word, header, and hash here is OSP-authored placeholder content.

const COMMIT = "2".repeat(40);
const WORDS = [0x03e00008, 0x8c820004];
const TARGET_TEXT = "glabel f\n    dw 0x03E00008 ; 0\n    dw 0x8C820004 ; 4\n";
const HEADER = new TextEncoder().encode(
  "/* OSP */\r\n#define TWICE(a) \\\r\n  ((a) * 2)\r\nint osp_value;\r\n",
);

const RAW = `https://raw.githubusercontent.com/FoxdieTeam/mgs_reversing/${COMMIT}/asm/osp/f.s`;
const CDN = `https://cdn.jsdelivr.net/gh/FoxdieTeam/mgs_reversing@${COMMIT}/asm/osp/f.s`;

async function target(): Promise<RemoteWords> {
  return {
    kind: "remote",
    commit: COMMIT,
    path: "asm/osp/f.s",
    wordCount: WORDS.length,
    wordsSha256: await wordsSha256(WORDS),
  };
}

async function header(
  overrides: Partial<RemoteCReference> = {},
): Promise<RemoteCReference> {
  return {
    repository: "FoxdieTeam/psyq_sdk",
    commit: COMMIT,
    path: "psyq_4.4/include/osp.h",
    sha256: await sha256Hex(HEADER),
    ...overrides,
  };
}

type Route = (init: RequestInit | undefined) => Promise<Response> | Response;

/** A fetch that answers from `routes` by URL and records every request. */
function fakeFetch(routes: Readonly<Record<string, Route>>) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, init });
    const route = routes[url];
    if (route === undefined) {
      return Promise.reject(new TypeError("Failed to fetch"));
    }
    return Promise.resolve(route(init));
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const ok = (body: string | Uint8Array) => () =>
  new Response(body as BodyInit, { status: 200 });

function service(
  routes: Readonly<Record<string, Route>>,
  options: {
    cache?: UpstreamCacheStore;
    timeoutMs?: number;
    maxBytes?: number;
  } = {},
) {
  const { fetch, calls } = fakeFetch(routes);
  const cache = options.cache ?? createMemoryStorage().upstreamCache;
  const upstream = createNetworkUpstream({
    fetch,
    cache,
    ...(options.timeoutMs === undefined
      ? {}
      : { timeoutMs: options.timeoutMs }),
    ...(options.maxBytes === undefined ? {} : { maxBytes: options.maxBytes }),
  });
  return { upstream, calls, cache };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createNetworkUpstream loadTarget", () => {
  it("loads verified words from the raw host without credentials", async () => {
    const { upstream, calls } = service({ [RAW]: ok(TARGET_TEXT) });

    await expect(upstream.loadTarget(await target())).resolves.toEqual({
      kind: "loaded",
      value: WORDS,
      source: "raw.githubusercontent.com",
    });
    expect(calls.map(({ url }) => url)).toEqual([RAW]);
    expect(calls[0]?.init?.credentials).toBe("omit");
    expect(calls[0]?.init?.method).toBeUndefined();
    expect(calls[0]?.init?.body).toBeUndefined();
  });

  it("falls back to jsDelivr after a raw-host 404", async () => {
    const { upstream, calls } = service({
      [RAW]: () => new Response("missing", { status: 404 }),
      [CDN]: ok(TARGET_TEXT),
    });

    await expect(upstream.loadTarget(await target())).resolves.toMatchObject({
      kind: "loaded",
      source: "cdn.jsdelivr.net",
    });
    expect(calls.map(({ url }) => url)).toEqual([RAW, CDN]);
  });

  it("falls back to jsDelivr after raw-host content fails its hash", async () => {
    const { upstream } = service({
      [RAW]: ok(TARGET_TEXT.replace("8C820004", "8C820008")),
      [CDN]: ok(TARGET_TEXT),
    });

    await expect(upstream.loadTarget(await target())).resolves.toMatchObject({
      kind: "loaded",
      source: "cdn.jsdelivr.net",
    });
  });

  it("reports unavailable with each attempt when both hosts fail", async () => {
    const { upstream, cache } = service({
      [RAW]: () => new Response("", { status: 503 }),
    });

    await expect(upstream.loadTarget(await target())).resolves.toEqual({
      kind: "unavailable",
      attempts: [
        {
          host: "raw.githubusercontent.com",
          result: "http-status",
          status: 503,
        },
        { host: "cdn.jsdelivr.net", result: "network-error" },
      ],
    });
    await expect(
      cache.get((await target()).wordsSha256),
    ).resolves.toBeUndefined();
  });

  it("reports a content mismatch, and caches nothing, when both hosts fail their hash", async () => {
    const wrong = ok(TARGET_TEXT.replace("03E00008", "03E00009"));
    const { upstream, cache } = service({ [RAW]: wrong, [CDN]: wrong });

    await expect(upstream.loadTarget(await target())).resolves.toEqual({
      kind: "content-mismatch",
      attempts: [
        { host: "raw.githubusercontent.com", result: "hash-mismatch" },
        { host: "cdn.jsdelivr.net", result: "hash-mismatch" },
      ],
    });
    await expect(
      cache.get((await target()).wordsSha256),
    ).resolves.toBeUndefined();
  });

  it("serves a second load from the cache without a request", async () => {
    const { upstream, calls } = service({ [RAW]: ok(TARGET_TEXT) });
    await upstream.loadTarget(await target());

    await expect(upstream.loadTarget(await target())).resolves.toEqual({
      kind: "loaded",
      value: WORDS,
      source: "cache",
    });
    expect(calls).toHaveLength(1);
  });

  it("refetches when a cached entry no longer verifies", async () => {
    const cache = createMemoryStorage().upstreamCache;
    const { wordsSha256: key } = await target();
    await cache.put(key, new TextEncoder().encode("dw 0x00000000\n"));
    const { upstream, calls } = service({ [RAW]: ok(TARGET_TEXT) }, { cache });

    await expect(upstream.loadTarget(await target())).resolves.toMatchObject({
      kind: "loaded",
      source: "raw.githubusercontent.com",
    });
    expect(calls).toHaveLength(1);
    await expect(upstream.loadTarget(await target())).resolves.toMatchObject({
      source: "cache",
    });
  });

  it("ignores a cached value that is not bytes and a cache that fails", async () => {
    const cache = createMemoryStorage().upstreamCache;
    await cache.put((await target()).wordsSha256, "not bytes");
    const first = service({ [RAW]: ok(TARGET_TEXT) }, { cache });
    await expect(
      first.upstream.loadTarget(await target()),
    ).resolves.toMatchObject({
      source: "raw.githubusercontent.com",
    });

    const failing: UpstreamCacheStore = {
      get: () => Promise.reject(new Error("storage")),
      put: () => Promise.reject(new Error("storage")),
      clear: () => Promise.resolve(),
    };
    const second = service({ [RAW]: ok(TARGET_TEXT) }, { cache: failing });
    await expect(
      second.upstream.loadTarget(await target()),
    ).resolves.toMatchObject({
      kind: "loaded",
      source: "raw.githubusercontent.com",
    });
  });

  it("rejects a body over the size cap, declared or streamed", async () => {
    const declared = () =>
      new Response(TARGET_TEXT, {
        status: 200,
        headers: { "content-length": "999999" },
      });
    const { upstream } = service(
      { [RAW]: declared, [CDN]: ok(TARGET_TEXT) },
      { maxBytes: 20 },
    );

    await expect(upstream.loadTarget(await target())).resolves.toEqual({
      kind: "unavailable",
      attempts: [
        { host: "raw.githubusercontent.com", result: "too-large" },
        { host: "cdn.jsdelivr.net", result: "too-large" },
      ],
    });
  });

  it("reads a body with no stream, within the cap or over it", async () => {
    const bodyless = (text: string) => () =>
      ({
        status: 200,
        headers: new Headers(),
        body: null,
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(text).buffer),
      }) as unknown as Response;
    const small = service({ [RAW]: bodyless(TARGET_TEXT) });
    await expect(
      small.upstream.loadTarget(await target()),
    ).resolves.toMatchObject({
      kind: "loaded",
    });

    const large = service(
      { [RAW]: bodyless(TARGET_TEXT), [CDN]: bodyless(TARGET_TEXT) },
      { maxBytes: 10 },
    );
    await expect(
      large.upstream.loadTarget(await target()),
    ).resolves.toMatchObject({
      kind: "unavailable",
      attempts: [{ result: "too-large" }, { result: "too-large" }],
    });
  });

  it("reports a timeout and moves on to the next host", async () => {
    vi.useFakeTimers();
    const hang: Route = (init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    const { upstream } = service(
      { [RAW]: hang, [CDN]: ok(TARGET_TEXT) },
      { timeoutMs: 1000 },
    );

    const outcome = upstream.loadTarget(await target());
    await vi.advanceTimersByTimeAsync(1000);
    await expect(outcome).resolves.toMatchObject({
      kind: "loaded",
      source: "cdn.jsdelivr.net",
    });
  });

  it("reports cancelled when the caller aborts, before or during a request", async () => {
    const before = new AbortController();
    before.abort();
    const idle = service({ [RAW]: ok(TARGET_TEXT) });
    await expect(
      idle.upstream.loadTarget(await target(), before.signal),
    ).resolves.toEqual({ kind: "cancelled" });
    expect(idle.calls).toHaveLength(0);

    const during = new AbortController();
    const hang: Route = (init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    const busy = service({ [RAW]: hang });
    const outcome = busy.upstream.loadTarget(await target(), during.signal);
    await vi.waitFor(() => {
      expect(busy.calls).toHaveLength(1);
    });
    during.abort();
    await expect(outcome).resolves.toEqual({ kind: "cancelled" });
  });

  it("makes no request for a malformed pointer", async () => {
    const { upstream, calls } = service({});
    await expect(
      upstream.loadTarget({ ...(await target()), path: "asm/../f.s" }),
    ).resolves.toEqual({ kind: "unavailable", attempts: [] });
    expect(calls).toHaveLength(0);
  });
});

describe("createNetworkUpstream loadC", () => {
  const SDK_RAW = `https://raw.githubusercontent.com/FoxdieTeam/psyq_sdk/${COMMIT}/psyq_4.4/include/osp.h`;
  const SDK_CDN = `https://cdn.jsdelivr.net/gh/FoxdieTeam/psyq_sdk@${COMMIT}/psyq_4.4/include/osp.h`;

  it("fetches a psyq_sdk header from its own repository and returns it whole with LF endings", async () => {
    const { upstream, calls } = service({ [SDK_RAW]: ok(HEADER) });

    await expect(upstream.loadC(await header())).resolves.toEqual({
      kind: "loaded",
      value: "/* OSP */\n#define TWICE(a) \\\n  ((a) * 2)\nint osp_value;\n",
      source: "raw.githubusercontent.com",
    });
    expect(calls.map(({ url }) => url)).toEqual([SDK_RAW]);
  });

  it("falls back to jsDelivr for a header", async () => {
    const { upstream } = service({ [SDK_CDN]: ok(HEADER) });
    await expect(upstream.loadC(await header())).resolves.toMatchObject({
      kind: "loaded",
      source: "cdn.jsdelivr.net",
    });
  });

  it("returns only the line span of a verified file, and caches the original bytes", async () => {
    const { upstream, cache } = service({ [SDK_RAW]: ok(HEADER) });

    await expect(
      upstream.loadC(await header({ lines: { start: 4, end: 4 } })),
    ).resolves.toMatchObject({ kind: "loaded", value: "int osp_value;\n" });
    const cached = await cache.get(await sha256Hex(HEADER));
    expect(Array.from(cached as Uint8Array)).toEqual(Array.from(HEADER));
  });

  it("makes no request for a repository outside the allowlist", async () => {
    const { upstream, calls } = service({});
    const reference = {
      ...(await header()),
      repository: "someone/else",
    } as unknown as RemoteCReference;

    await expect(upstream.loadC(reference)).resolves.toEqual({
      kind: "unavailable",
      attempts: [],
    });
    expect(calls).toHaveLength(0);
  });

  it("clears its cache", async () => {
    const { upstream, calls } = service({ [SDK_RAW]: ok(HEADER) });
    await upstream.loadC(await header());
    await upstream.clearCache();
    await upstream.loadC(await header());
    expect(calls).toHaveLength(2);
  });
});

import type { Mission, RemoteCReference } from "@osp/mission-schema";
import {
  PLACEHOLDER_COMMIT,
  PLACEHOLDER_HASH,
  syntheticMission,
} from "@osp/mission-schema/testing";
import { describe, expect, it, vi } from "vitest";
import type {
  UpstreamAttempt,
  UpstreamOutcome,
  UpstreamService,
} from "../upstream/types";
import { createMissionContextResolver } from "./missionContextResolver";

type LoadC = UpstreamService["loadC"];

function upstreamWith(loadC: LoadC): UpstreamService {
  return {
    loadC,
    loadTarget: () =>
      Promise.reject(new Error("Context resolution never loads targets.")),
    clearCache: () => Promise.resolve(),
  };
}

function reference(path: string): RemoteCReference {
  return {
    repository: "FoxdieTeam/mgs_reversing",
    commit: PLACEHOLDER_COMMIT,
    path,
    sha256: PLACEHOLDER_HASH,
  };
}

function missionWith(
  headers: Readonly<Record<string, string>>,
  remoteHeaders?: Readonly<Record<string, RemoteCReference>>,
): Mission {
  const mission = syntheticMission();
  return {
    ...mission,
    compiler: {
      ...mission.compiler,
      headers,
      ...(remoteHeaders === undefined ? {} : { remoteHeaders }),
    },
  };
}

const loadedAs =
  (text: (reference: RemoteCReference) => string): LoadC =>
  (ref) =>
    Promise.resolve({ kind: "loaded", value: text(ref), source: "cache" });

const ATTEMPTS: readonly UpstreamAttempt[] = [
  { host: "raw.githubusercontent.com", result: "http-status", status: 404 },
  { host: "cdn.jsdelivr.net", result: "network-error" },
];

describe("createMissionContextResolver", () => {
  it("resolves a mission with only authored headers without loading anything", async () => {
    const loadC = vi.fn<LoadC>();
    const mission = missionWith({ "codec.h": "#define OSP_RATE 5\n" });

    const outcome = await createMissionContextResolver(
      upstreamWith(loadC),
    ).resolve(mission, "int f(void);\n");

    expect(loadC).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      kind: "ready",
      input: {
        filename: "mission.c",
        source: "int f(void);\n",
        headers: { "codec.h": "#define OSP_RATE 5\n" },
        cppFlags: mission.compiler.cppFlags,
        rawFlags: ["-O2"],
        gpSize: 0,
        aspsxVersion: "2.77",
        encoding: "utf8",
      },
    });
  });

  it("loads remote headers in parallel and merges them with authored headers", async () => {
    const pending: ((outcome: UpstreamOutcome<string>) => void)[] = [];
    const loadC = vi.fn<LoadC>(
      (ref) =>
        new Promise((resolve) => {
          pending.push(() => {
            resolve({
              kind: "loaded",
              value: `/* ${ref.path} */\n`,
              source: "raw.githubusercontent.com",
            });
          });
        }),
    );
    const controller = new AbortController();
    const mission = missionWith(
      { "local.h": "#define OSP_LOCAL 1\n" },
      {
        "source/include/b.h": reference("source/include/b.h"),
        "psyq/include/a.h": reference("psyq_4.4/include/a.h"),
      },
    );

    const resolving = createMissionContextResolver(upstreamWith(loadC)).resolve(
      mission,
      "",
      controller.signal,
    );

    expect(loadC).toHaveBeenCalledTimes(2);
    expect(loadC).toHaveBeenCalledWith(
      reference("psyq_4.4/include/a.h"),
      controller.signal,
    );
    for (const finish of pending) {
      finish({ kind: "cancelled" });
    }

    const outcome = await resolving;
    expect(outcome.kind === "ready" && outcome.input.headers).toEqual({
      "local.h": "#define OSP_LOCAL 1\n",
      "psyq/include/a.h": "/* psyq_4.4/include/a.h */\n",
      "source/include/b.h": "/* source/include/b.h */\n",
    });
  });

  it("reports an unavailable header by its path", async () => {
    const mission = missionWith(
      {},
      { "source/include/lost.h": reference("source/include/lost.h") },
    );

    const outcome = await createMissionContextResolver(
      upstreamWith(() =>
        Promise.resolve({ kind: "unavailable", attempts: ATTEMPTS }),
      ),
    ).resolve(mission, "");

    expect(outcome).toEqual({
      kind: "unavailable",
      path: "source/include/lost.h",
      attempts: ATTEMPTS,
    });
  });

  it("reports the first failing header by path when several fail", async () => {
    const outcomes: Readonly<Record<string, UpstreamOutcome<string>>> = {
      "a.h": { kind: "loaded", value: "", source: "cache" },
      "m.h": { kind: "content-mismatch", attempts: ATTEMPTS },
      "z.h": { kind: "unavailable", attempts: [] },
    };
    const mission = missionWith(
      {},
      {
        "source/z.h": reference("z.h"),
        "source/m.h": reference("m.h"),
        "source/a.h": reference("a.h"),
      },
    );

    const outcome = await createMissionContextResolver(
      upstreamWith((ref) =>
        Promise.resolve(outcomes[ref.path] ?? { kind: "cancelled" }),
      ),
    ).resolve(mission, "");

    expect(outcome).toEqual({
      kind: "content-mismatch",
      path: "source/m.h",
      attempts: ATTEMPTS,
    });
  });

  it("is cancelled before loading when the signal has already fired", async () => {
    const loadC = vi.fn<LoadC>();
    const controller = new AbortController();
    controller.abort();

    const outcome = await createMissionContextResolver(
      upstreamWith(loadC),
    ).resolve(
      missionWith({}, { "source/a.h": reference("a.h") }),
      "",
      controller.signal,
    );

    expect(outcome).toEqual({ kind: "cancelled" });
    expect(loadC).not.toHaveBeenCalled();
  });

  it("is cancelled when the signal fires while headers load", async () => {
    const controller = new AbortController();
    const outcome = await createMissionContextResolver(
      upstreamWith((ref) => {
        controller.abort();
        return loadedAs(() => "")(ref);
      }),
    ).resolve(
      missionWith({}, { "source/a.h": reference("a.h") }),
      "",
      controller.signal,
    );

    expect(outcome).toEqual({ kind: "cancelled" });
  });

  it("is cancelled when a header load is cancelled", async () => {
    const outcome = await createMissionContextResolver(
      upstreamWith(() => Promise.resolve({ kind: "cancelled" })),
    ).resolve(missionWith({}, { "source/a.h": reference("a.h") }), "");

    expect(outcome).toEqual({ kind: "cancelled" });
  });
});

import { describe, expect, it, vi } from "vitest";
import { assembledObject } from "../../test/fakeToolchain";
import type {
  AssembledObject,
  BuildOutcome,
  CompilationInput,
  ToolchainService,
} from "../compiler/types";
import { readDeclarations } from "./declarations";
import { probeObject } from "./probe.test-helpers";
import {
  PROBE_SYMBOL,
  probeSource,
  probeWords,
  runOffsetProbe,
} from "./offsetProbe";

// OSP-authored C and made-up words; the real compiler is checked in
// offsetProbe.node.test.ts.
const HEADER =
  "typedef struct { char tag; int count; } Item;\nstruct Pair { short a; short b; };\n";
const STARTER = '#include "item.h"\nint f(Item *i) { return 0; }\n';

const input: CompilationInput = {
  filename: "f.c",
  source: "",
  headers: { "item.h": HEADER },
  cppFlags: [],
  rawFlags: [],
  gpSize: 8,
  aspsxVersion: "2.77",
  encoding: "utf8",
};

function success(
  object: AssembledObject,
  preprocessed?: string | Uint8Array,
): BuildOutcome {
  return {
    kind: "success",
    object,
    compilerText: "",
    diagnostics: [],
    ...(preprocessed === undefined
      ? {}
      : {
          preprocessed:
            typeof preprocessed === "string"
              ? new TextEncoder().encode(preprocessed)
              : preprocessed,
        }),
  };
}

function toolchain(...outcomes: BuildOutcome[]) {
  const build = vi.fn<ToolchainService["build"]>();
  for (const outcome of outcomes) {
    build.mockResolvedValueOnce(outcome);
  }
  return { build };
}

const preprocessed = `# 1 "f.c"\n${HEADER}int f(Item *i) { return 0; }\n`;

describe("probeSource", () => {
  it("appends each type's size, then each field's offset and size", () => {
    expect(
      probeSource("int f(void);\n", readDeclarations(HEADER, ["Item", "Nope"])),
    ).toBe(
      [
        "int f(void);",
        "",
        `int ${PROBE_SYMBOL}[] = {`,
        "    (int)sizeof(Item),",
        "    (int)&((Item *)0)->tag,",
        "    (int)sizeof(((Item *)0)->tag),",
        "    (int)&((Item *)0)->count,",
        "    (int)sizeof(((Item *)0)->count)",
        "};",
        "",
      ].join("\n"),
    );
  });
});

describe("probeWords", () => {
  it("reads signed little-endian words at the symbol's offset", () => {
    expect([...(probeWords(probeObject([8, -1], 4), 2) ?? [])]).toEqual([
      8, -1,
    ]);
  });

  it("finds nothing without the symbol, or with too few bytes", () => {
    expect(probeWords(assembledObject([]), 1)).toBeUndefined();
    expect(probeWords(probeObject([8]), 2)).toBeUndefined();
  });
});

describe("runOffsetProbe", () => {
  it("builds the starter, then the probe, and lays out each type", async () => {
    const service = toolchain(
      success(assembledObject([]), preprocessed),
      success(probeObject([8, 0, 1, 4, 4, 4, 0, 2, 2, 2])),
    );
    const controller = new AbortController();

    const outcome = await runOffsetProbe(
      service,
      input,
      STARTER,
      ["Item", "struct Pair", "Missing"],
      controller.signal,
    );

    expect(service.build.mock.calls.map(([call]) => call.source)).toEqual([
      STARTER,
      expect.stringContaining(`int ${PROBE_SYMBOL}[]`),
    ]);
    expect(service.build.mock.calls[1]?.[0]).toMatchObject({
      headers: input.headers,
      gpSize: 8,
    });
    expect(service.build.mock.calls[1]?.[1]).toBe(controller.signal);
    expect(outcome).toEqual({
      kind: "measured",
      types: [
        {
          kind: "measured",
          name: "Item",
          size: 8,
          fields: [
            {
              name: "tag",
              typeText: "char",
              kind: "scalar",
              offset: 0,
              size: 1,
            },
            {
              name: "count",
              typeText: "int",
              kind: "scalar",
              offset: 4,
              size: 4,
            },
          ],
        },
        {
          kind: "measured",
          name: "struct Pair",
          size: 4,
          fields: [
            {
              name: "a",
              typeText: "short",
              kind: "scalar",
              offset: 0,
              size: 2,
            },
            {
              name: "b",
              typeText: "short",
              kind: "scalar",
              offset: 2,
              size: 2,
            },
          ],
        },
        {
          kind: "unavailable",
          name: "Missing",
          reason: "its declaration was not found",
        },
      ],
    });
  });

  it("reads declarations from EUC-JP preprocessor output", async () => {
    const eucjp = Uint8Array.from([
      ...new TextEncoder().encode('char *s = "'),
      0xa4,
      0xa2,
      ...new TextEncoder().encode('";\nstruct Pair { short a; };\n'),
    ]);
    const service = toolchain(
      success(assembledObject([]), eucjp),
      success(probeObject([2, 0, 2])),
    );
    const outcome = await runOffsetProbe(
      service,
      { ...input, encoding: "eucjp" },
      STARTER,
      ["struct Pair"],
    );
    expect(outcome).toMatchObject({
      kind: "measured",
      types: [{ kind: "measured", size: 2 }],
    });
  });

  it("skips the second build when no type can be measured", async () => {
    const service = toolchain(success(assembledObject([]), preprocessed));
    const outcome = await runOffsetProbe(service, input, STARTER, ["Missing"]);
    expect(service.build).toHaveBeenCalledOnce();
    expect(outcome).toEqual({
      kind: "measured",
      types: [
        {
          kind: "unavailable",
          name: "Missing",
          reason: "its declaration was not found",
        },
      ],
    });
  });

  it.each<[string, BuildOutcome, unknown]>([
    ["a cancelled build", { kind: "cancelled" }, { kind: "cancelled" }],
    [
      "a compiler failure",
      {
        kind: "compiler-failure",
        diagnostics: [{ severity: "error", message: "parse error" }],
      },
      {
        kind: "failed",
        message: "The starting source did not compile.",
        diagnostics: [{ severity: "error", message: "parse error" }],
      },
    ],
    [
      "an assembler failure",
      { kind: "assembler-failure", compilerText: "", diagnostics: [] },
      {
        kind: "failed",
        message: "The starting source did not assemble.",
        diagnostics: [],
      },
    ],
    [
      "a timeout",
      { kind: "timeout", timeoutMs: 5 },
      {
        kind: "failed",
        message: "The starting source took too long to compile.",
        diagnostics: [],
      },
    ],
    [
      "an infrastructure failure",
      { kind: "infrastructure-failure", message: "worker gone" },
      { kind: "failed", message: "worker gone", diagnostics: [] },
    ],
    [
      "a build without preprocessor output",
      success(assembledObject([])),
      {
        kind: "failed",
        message: "The starting source produced no offsets.",
        diagnostics: [],
      },
    ],
  ])("reports %s of the starter", async (_name, starter, expected) => {
    const outcome = await runOffsetProbe(toolchain(starter), input, STARTER, [
      "Item",
    ]);
    expect(outcome).toEqual(expected);
  });

  it("reports a probe that fails or defines no words", async () => {
    await expect(
      runOffsetProbe(
        toolchain(success(assembledObject([]), preprocessed), {
          kind: "compiler-failure",
          diagnostics: [],
        }),
        input,
        STARTER,
        ["Item"],
      ),
    ).resolves.toEqual({
      kind: "failed",
      message: "The offset probe did not compile.",
      diagnostics: [],
    });
    await expect(
      runOffsetProbe(
        toolchain(
          success(assembledObject([]), preprocessed),
          success(assembledObject([])),
        ),
        input,
        STARTER,
        ["Item"],
      ),
    ).resolves.toEqual({
      kind: "failed",
      message: "The offset probe produced no offsets.",
      diagnostics: [],
    });
  });
});

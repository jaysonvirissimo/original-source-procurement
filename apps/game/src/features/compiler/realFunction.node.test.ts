import { feasibilityPointers } from "@osp/curriculum";
import { matchFunction } from "@osp/matching-core";
import type { FeasibilityPointer } from "@osp/mission-schema";
import { assemble } from "psyq-asm";
import { createCompiler } from "psyq-wasm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  checkoutsFromEnvironment,
  createLocalCheckoutUpstream,
  readCheckoutBlob,
  type LocalCheckouts,
} from "../../test/localCheckoutUpstream.node";
import type { UpstreamService } from "../upstream/types";
import { PSYQ_ASM_VERSION } from "./browserToolchain";
import { createMissionContextResolver } from "./missionContextResolver";
import { createToolchainService } from "./toolchainService";
import type { CompilationInput, ToolchainService } from "./types";

// Upstream content is read at run time from local checkouts named by
// OSP_MGS_REVERSING_DIR and OSP_PSYQ_SDK_DIR, and this suite is skipped when
// they are unset. Assertions and messages never include words or C.

const checkouts = checkoutsFromEnvironment();

function requireCheckouts(): LocalCheckouts {
  if (checkouts === undefined) {
    throw new Error("Local upstream checkouts are not configured.");
  }
  return checkouts;
}

/**
 * Adds 1 to the first integer literal in the body of `symbol`'s definition,
 * so the test changes one token without carrying any upstream text.
 */
function changeFirstIntegerLiteral(source: string, symbol: string): string {
  const definition = new RegExp(`\\b${symbol}\\s*\\([^;{]*\\)\\s*\\{`).exec(
    source,
  );
  if (definition === null) {
    throw new Error(`No definition of ${symbol} was found.`);
  }
  const bodyStart = definition.index + definition[0].length;
  const literal = /\b\d+\b/.exec(source.slice(bodyStart));
  if (literal === null) {
    throw new Error(`${symbol} has no integer literal to change.`);
  }
  const start = bodyStart + literal.index;
  return (
    source.slice(0, start) +
    String(Number(literal[0]) + 1) +
    source.slice(start + literal[0].length)
  );
}

describe.skipIf(checkouts === undefined)(
  "real solved functions from local checkouts",
  () => {
    let service: ToolchainService;
    let upstream: UpstreamService;

    beforeAll(async () => {
      upstream = createLocalCheckoutUpstream(requireCheckouts());
      service = await createToolchainService({
        createCompiler: () => createCompiler(),
        assemble,
        psyqAsmVersion: PSYQ_ASM_VERSION,
      });
    }, 30_000);

    afterAll(() => {
      service.dispose();
    });

    async function loadWords(pointer: FeasibilityPointer): Promise<number[]> {
      const outcome = await upstream.loadTarget(pointer.target);
      if (outcome.kind !== "loaded") {
        throw new Error(`The target did not load: ${outcome.kind}.`);
      }
      return [...outcome.value];
    }

    async function loadSolution(pointer: FeasibilityPointer): Promise<string> {
      const outcome = await upstream.loadC(pointer.solution);
      if (outcome.kind !== "loaded") {
        throw new Error(`The solution did not load: ${outcome.kind}.`);
      }
      return outcome.value;
    }

    async function resolve(
      compiler: FeasibilityPointer["compiler"],
      source: string,
    ): Promise<CompilationInput> {
      const outcome = await createMissionContextResolver(upstream).resolve(
        { compiler },
        source,
      );
      if (outcome.kind !== "ready") {
        throw new Error(`Context did not resolve: ${outcome.kind}.`);
      }
      return outcome.input;
    }

    async function exactness(
      pointer: FeasibilityPointer,
      input: CompilationInput,
      words: readonly number[],
    ) {
      const build = await service.build(input);
      if (build.kind !== "success") {
        return { build: build.kind } as const;
      }
      const outcome = matchFunction(build.object, pointer.symbol, {
        kind: "linked",
        words,
      });
      return outcome.kind === "matched"
        ? ({
            build: build.kind,
            exact: outcome.result.exact,
            kinds: outcome.result.mismatches.map((mismatch) => mismatch.kind),
          } as const)
        : ({ build: build.kind, match: outcome.kind } as const);
    }

    describe.each(
      feasibilityPointers.map((pointer) => [pointer.symbol, pointer] as const),
    )("%s", (_symbol, pointer) => {
      it("reaches an exact match from its recorded context", async () => {
        const words = await loadWords(pointer);
        const input = await resolve(
          pointer.compiler,
          await loadSolution(pointer),
        );

        expect(await exactness(pointer, input, words)).toEqual({
          build: "success",
          exact: true,
          kinds: [],
        });
      }, 60_000);

      it("stops matching when one token of the solution changes", async () => {
        const words = await loadWords(pointer);
        const source = changeFirstIntegerLiteral(
          await loadSolution(pointer),
          pointer.symbol,
        );
        const result = await exactness(
          pointer,
          await resolve(pointer.compiler, source),
          words,
        );

        expect(result).toMatchObject({ build: "success", exact: false });
        expect(
          "kinds" in result && result.kinds.some((kind) => kind !== "UNKNOWN"),
        ).toBe(true);
      }, 60_000);

      it("needs every recorded header", async () => {
        const words = await loadWords(pointer);
        const source = await loadSolution(pointer);
        const remoteHeaders = pointer.compiler.remoteHeaders ?? {};

        for (const key of Object.keys(remoteHeaders)) {
          const compiler = {
            ...pointer.compiler,
            remoteHeaders: Object.fromEntries(
              Object.entries(remoteHeaders).filter(([other]) => other !== key),
            ),
          };
          const result = await exactness(
            pointer,
            await resolve(compiler, source),
            words,
          );
          expect({ key, exact: "exact" in result && result.exact }).toEqual({
            key,
            exact: false,
          });
        }
      }, 300_000);

      it("reads PsyQ SDK headers from psyq_sdk, CRLF on disk and LF once loaded", async () => {
        const sdkHeaders = Object.entries(
          pointer.compiler.remoteHeaders ?? {},
        ).filter(([key]) => key.startsWith("psyq/include/"));
        expect(sdkHeaders.length).toBeGreaterThan(0);

        let crlfHeaders = 0;
        for (const [key, reference] of sdkHeaders) {
          expect({ key, repository: reference.repository }).toEqual({
            key,
            repository: "FoxdieTeam/psyq_sdk",
          });
          const bytes = await readCheckoutBlob(
            requireCheckouts(),
            reference.repository,
            reference.commit,
            reference.path,
          );
          const loaded = await upstream.loadC(reference);
          expect(loaded.kind).toBe("loaded");
          if (bytes?.includes(13) === true && loaded.kind === "loaded") {
            crlfHeaders += 1;
            expect(loaded.value.includes("\r")).toBe(false);
          }
        }
        expect(crlfHeaders).toBeGreaterThan(0);
      }, 60_000);
    });
  },
);

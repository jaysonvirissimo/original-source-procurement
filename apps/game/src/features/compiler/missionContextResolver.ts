import type { Mission } from "@osp/mission-schema";
import type { UpstreamAttempt, UpstreamService } from "../upstream/types";
import type { CompilationInput } from "./types";

export type ResolveOutcome =
  | { readonly kind: "ready"; readonly input: CompilationInput }
  | {
      readonly kind: "unavailable";
      readonly path: string;
      readonly attempts: readonly UpstreamAttempt[];
    }
  | {
      readonly kind: "content-mismatch";
      readonly path: string;
      readonly attempts: readonly UpstreamAttempt[];
    }
  | { readonly kind: "cancelled" };

export interface MissionContextResolver {
  /** Only the mission's compiler settings are read. */
  resolve(
    mission: Pick<Mission, "compiler">,
    source: string,
    signal?: AbortSignal,
  ): Promise<ResolveOutcome>;
}

/**
 * Turns a mission and the player's source into a complete compilation input.
 *
 * Compiler settings are copied from the mission unchanged; no flags or
 * include paths are added. Every remote header loads as a whole file, in
 * parallel. If any of them fails, the outcome names that header and carries
 * no input, so a build never starts with a partial header set. When several
 * fail, the first by header path is reported. Includes are never discovered:
 * a header missing from the mission's set surfaces as compiler diagnostics.
 */
export function createMissionContextResolver(
  upstream: UpstreamService,
): MissionContextResolver {
  return {
    async resolve(mission, source, signal) {
      const aborted = (): boolean => signal?.aborted === true;
      if (aborted()) {
        return { kind: "cancelled" };
      }

      const { compiler } = mission;
      // Header keys are unique, so no two compare equal.
      const remote = Object.entries(compiler.remoteHeaders ?? {}).sort(
        ([a], [b]) => (a < b ? -1 : 1),
      );
      const loaded = await Promise.all(
        remote.map(async ([path, reference]) => ({
          path,
          outcome: await upstream.loadC(reference, signal),
        })),
      );

      if (aborted()) {
        return { kind: "cancelled" };
      }

      const remoteHeaders: [string, string][] = [];
      for (const { path, outcome } of loaded) {
        switch (outcome.kind) {
          case "loaded":
            remoteHeaders.push([path, outcome.value]);
            break;
          case "unavailable":
          case "content-mismatch":
            return { kind: outcome.kind, path, attempts: outcome.attempts };
          case "cancelled":
            return { kind: "cancelled" };
        }
      }

      return {
        kind: "ready",
        input: {
          filename: compiler.filename,
          source,
          headers: {
            ...compiler.headers,
            ...Object.fromEntries(remoteHeaders),
          },
          cppFlags: compiler.cppFlags,
          rawFlags: compiler.rawFlags,
          gpSize: compiler.gpSize,
          aspsxVersion: compiler.aspsxVersion,
          encoding: compiler.encoding,
        },
      };
    },
  };
}

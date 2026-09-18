import { callWords, type MatchTarget } from "@osp/matching-core";
import type { Mission } from "@osp/mission-schema";
import { createMissionContextResolver } from "../compiler/missionContextResolver";
import type { CompilationInput } from "../compiler/types";
import type { UpstreamService } from "../upstream/types";

interface UnusableContent {
  readonly kind: "unavailable" | "content-mismatch";
  /** The upstream file that could not be used. */
  readonly path: string;
}

/** Everything a mission needs before Compile is enabled. */
export type MissionContextOutcome =
  | {
      readonly kind: "ready";
      readonly input: CompilationInput;
      readonly target: MatchTarget;
    }
  | UnusableContent
  | { readonly kind: "cancelled" };

type TargetOutcome =
  | { readonly kind: "target"; readonly target: MatchTarget }
  | UnusableContent
  | { readonly kind: "cancelled" };

/**
 * An inline target compares with its relocations. Upstream target words come
 * from the linked game, so they compare under relocation masks, plus the
 * callee the corpus records for each call (ADR 0024).
 */
async function loadTarget(
  target: Mission["target"],
  upstream: UpstreamService,
  signal: AbortSignal | undefined,
): Promise<TargetOutcome> {
  if (target.kind === "inline") {
    return {
      kind: "target",
      target: {
        kind: "unlinked",
        words: target.words,
        relocations: target.relocations,
      },
    };
  }
  const outcome = await upstream.loadTarget(target, signal);
  switch (outcome.kind) {
    case "loaded":
      // Every call is checked only if every call is recorded. Words that hash
      // correctly always agree; this guards a corpus written by hand.
      if (!sameCalls(outcome.value, target.calls)) {
        return { kind: "content-mismatch", path: target.path };
      }
      return {
        kind: "target",
        target: {
          kind: "linked",
          words: outcome.value,
          calls: target.calls.map((call) => ({
            word: call.word,
            callee: call.symbol,
          })),
        },
      };
    case "cancelled":
      return outcome;
    case "unavailable":
    case "content-mismatch":
      return { kind: outcome.kind, path: target.path };
  }
}

function sameCalls(
  words: readonly number[],
  calls: readonly { readonly word: number }[],
): boolean {
  const expected = callWords(words);
  return (
    expected.length === calls.length &&
    expected.every((word, index) => calls[index]?.word === word)
  );
}

/**
 * Loads a mission's target, from upstream when it lives there, together with
 * its context headers. The mission is ready only when both succeed. A failed
 * target is reported before a failed header, because without the target
 * there is nothing to compare.
 */
export async function loadMissionContext(
  mission: Pick<Mission, "compiler" | "target" | "starterSource">,
  upstream: UpstreamService,
  signal?: AbortSignal,
): Promise<MissionContextOutcome> {
  const [loaded, resolved] = await Promise.all([
    loadTarget(mission.target, upstream, signal),
    createMissionContextResolver(upstream).resolve(
      mission,
      mission.starterSource,
      signal,
    ),
  ]);
  if (loaded.kind === "cancelled" || resolved.kind === "cancelled") {
    return { kind: "cancelled" };
  }
  if (loaded.kind !== "target") {
    return loaded;
  }
  if (resolved.kind !== "ready") {
    return { kind: resolved.kind, path: resolved.path };
  }
  return { kind: "ready", input: resolved.input, target: loaded.target };
}

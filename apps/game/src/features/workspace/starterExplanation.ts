import { wordFacts, type MatchResult } from "@osp/matching-core";

/** Single-word differences whose effect can be named from the words alone. */
const EXPLAINED_KINDS: ReadonlySet<string> = new Set([
  "OPCODE",
  "IMMEDIATE",
  "REGISTER",
]);

const LEAD =
  "This is the starting source, unchanged. It compiles, but it does not do what the target does yet. Compare the rows marked as different.";

function registers(names: readonly string[]): string {
  return names.join(" and ");
}

function writesOf(word: number): string[] {
  return wordFacts([word]).flatMap((facts) => facts.writes);
}

/**
 * What to say when the starting source, unchanged, does not match. It names
 * what the words show, never what to type.
 */
export function starterExplanation(result: MatchResult): string[] {
  if (result.exact) {
    return [];
  }
  const [only, ...rest] = result.mismatches;
  if (
    only === undefined ||
    rest.length > 0 ||
    !EXPLAINED_KINDS.has(only.kind) ||
    only.targetRange.end - only.targetRange.start !== 1 ||
    only.generatedRange.end - only.generatedRange.start !== 1
  ) {
    return [LEAD];
  }
  const details = result.target
    .slice(only.targetRange.start, only.targetRange.end)
    .flatMap((target) =>
      result.generated
        .slice(only.generatedRange.start, only.generatedRange.end)
        .flatMap((generated) => {
          const writes = writesOf(target.word);
          if (writes.length === 0) {
            return [];
          }
          return [
            registers(writes) === registers(writesOf(generated.word))
              ? `Both sides write ${registers(writes)}, but they compute it differently: the target runs ${target.text}, and your output runs ${generated.text}.`
              : `The target runs ${target.text}, which writes ${registers(writes)}; your output runs ${generated.text} there.`,
          ];
        }),
    );
  return [LEAD, ...details];
}

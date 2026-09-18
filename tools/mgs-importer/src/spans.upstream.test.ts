import { describe, expect, it } from "vitest";
import { readOverrides } from "./artifacts.ts";
import { checkoutsFromEnvironment, createGitReader } from "./checkout.ts";
import { sha256Hex } from "./hash.ts";
import { functionSpan } from "./spans.ts";

// Upstream content is read at run time from the local checkout named by
// OSP_MGS_REVERSING_DIR, and this suite is skipped when it is unset. The
// assertions compare numbers and hashes only and never print upstream text.

const checkouts = checkoutsFromEnvironment();

describe.skipIf(checkouts === undefined)(
  "every recorded stage 9 reveal is the function's own span",
  () => {
    it("reproduces each real mission's span and file hash", async () => {
      if (checkouts === undefined) {
        return;
      }
      const upstream = createGitReader(checkouts.mgsReversing);
      const overrides = await readOverrides();
      const decoder = new TextDecoder();
      for (const mission of overrides.missions) {
        for (const hint of mission.hints) {
          if (
            hint.stage !== 9 ||
            hint.reveal?.lines === undefined ||
            hint.reveal.repository !== "FoxdieTeam/mgs_reversing"
          ) {
            continue;
          }
          const bytes = await upstream.blob(
            hint.reveal.commit,
            hint.reveal.path,
          );
          expect(bytes, `${mission.symbol}: ${hint.reveal.path}`).toBeDefined();
          if (bytes === undefined) {
            continue;
          }
          expect(sha256Hex(bytes), mission.symbol).toBe(hint.reveal.sha256);
          const span = functionSpan(decoder.decode(bytes), mission.symbol);
          expect(
            span && { start: span.start, end: span.end },
            mission.symbol,
          ).toEqual(hint.reveal.lines);
        }
      }
    });
  },
);

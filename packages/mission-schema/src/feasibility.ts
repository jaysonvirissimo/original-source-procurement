import { z } from "zod";
import { checkUpstreamBuild, CompilerSettingsSchema } from "./compiler.ts";
import { VerifiedToolchainSchema } from "./corpus.ts";
import { SymbolSchema } from "./primitives.ts";
import { RemoteCReferenceSchema, type RemoteCReference } from "./remote.ts";
import { MissionSourceSchema } from "./source.ts";
import { RemoteTargetSchema } from "./target.ts";

export const FEASIBILITY_POINTER_SCHEMA_VERSION = 1;

/** Where upstream's default build finds the PsyQ SDK headers in psyq_sdk. */
export const SDK_INCLUDE_PATH = "psyq_4.4/include/";

/** The virtual prefix SDK headers are keyed under, found by -Ipsyq/include. */
export const SDK_HEADER_PREFIX = "psyq/include/";

/**
 * A pointer to one solved upstream function, used to check that a real
 * function compiles from its recorded context and matches its target. It
 * holds commits, paths, and hashes only; every file is read at run time.
 * `solution` is the whole upstream source file that defines the function.
 */
export const FeasibilityPointerSchema = z
  .strictObject({
    schemaVersion: z.literal(FEASIBILITY_POINTER_SCHEMA_VERSION),
    symbol: SymbolSchema,
    source: MissionSourceSchema,
    target: RemoteTargetSchema,
    solution: RemoteCReferenceSchema,
    compiler: CompilerSettingsSchema,
    // The toolchain the reproduction was last proved with.
    toolchain: VerifiedToolchainSchema,
  })
  .superRefine((pointer, ctx) => {
    const report = (path: readonly (string | number)[], message: string) => {
      ctx.addIssue({ code: "custom", path: [...path], message });
    };

    if (pointer.source.kind !== "mgs-reversing") {
      report(["source"], "A pointer must record its upstream provenance.");
    } else {
      if (pointer.source.symbol !== pointer.symbol) {
        report(["symbol"], "A pointer's symbol must match its source symbol.");
      }
      if (pointer.source.sourcePath !== pointer.solution.path) {
        report(
          ["solution", "path"],
          "The solution must be the source file named by the provenance.",
        );
      }
    }

    if (pointer.solution.repository !== "FoxdieTeam/mgs_reversing") {
      report(
        ["solution", "repository"],
        "The solution comes from mgs_reversing.",
      );
    }
    if (pointer.solution.lines !== undefined) {
      report(
        ["solution", "lines"],
        "The solution is a whole file and takes no line span.",
      );
    }

    checkUpstreamBuild(pointer.compiler, "Real-function pointers", report);

    const sourceDirectory = directoryOf(pointer.solution.path);
    for (const [key, reference] of Object.entries(
      pointer.compiler.remoteHeaders ?? {},
    )) {
      if (!headerKeys(reference, sourceDirectory).includes(key)) {
        report(
          ["compiler", "remoteHeaders", key],
          `A remote header is keyed by its mgs_reversing path or its path from the source file's directory, or under ${SDK_HEADER_PREFIX} for a psyq_sdk header in ${SDK_INCLUDE_PATH}.`,
        );
      }
    }
  });
export type FeasibilityPointer = z.infer<typeof FeasibilityPointerSchema>;

/**
 * The virtual paths a remote header may be keyed under. The compiled file
 * sits at the virtual root, standing for its upstream directory, so a header
 * beside it is found by a quoted include under its path from that directory.
 * Every other header is found through upstream's -I flags.
 */
export function headerKeys(
  reference: RemoteCReference,
  sourceDirectory: string,
): string[] {
  if (reference.repository === "FoxdieTeam/psyq_sdk") {
    return reference.path.startsWith(SDK_INCLUDE_PATH)
      ? [SDK_HEADER_PREFIX + reference.path.slice(SDK_INCLUDE_PATH.length)]
      : [];
  }
  return sourceDirectory !== "" && reference.path.startsWith(sourceDirectory)
    ? [reference.path, reference.path.slice(sourceDirectory.length)]
    : [reference.path];
}

/** A path's directory with its trailing slash, or "" for a bare file name. */
export function directoryOf(path: string): string {
  return path.slice(0, path.lastIndexOf("/") + 1);
}

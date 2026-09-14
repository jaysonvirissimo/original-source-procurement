import { z } from "zod";
import { RelativePathSchema } from "./primitives.ts";
import { RemoteCReferenceSchema } from "./remote.ts";

/**
 * psyq-wasm 1.0.0's `DEFAULT_CPP_FLAGS`: the PsyQ 4.4 predefined macros.
 * A caller-supplied `cppFlags` replaces this list instead of extending it,
 * so every mission stores the complete list, starting with these flags.
 * This package does not depend on psyq-wasm, so the list is kept in step
 * with the pinned version by hand.
 */
export const PSYQ_WASM_DEFAULT_CPP_FLAGS = [
  "-D__GNUC__=2",
  "-D__OPTIMIZE__",
  "-lang-c",
  "-Dmips",
  "-D__mips__",
  "-D__mips",
  "-Dpsx",
  "-D__psx__",
  "-D__psx",
  "-D_PSYQ",
  "-D__EXTENSIONS__",
  "-D_MIPSEL",
  "-D__CHAR_UNSIGNED__",
  "-D_LANGUAGE_C",
  "-DLANGUAGE_C",
] as const;

/**
 * Compiler input for upstream's default game build. `-DINTEGRAL` matches
 * upstream's preprocessor command. SDK headers are keyed under
 * `psyq/include/`, and upstream headers under `source/`.
 */
export const UPSTREAM_DEFAULT_BUILD = {
  aspsxVersion: "2.77",
  cppFlags: [
    ...PSYQ_WASM_DEFAULT_CPP_FLAGS,
    "-DINTEGRAL",
    "-Ipsyq/include",
    "-Isource",
    "-Isource/include",
  ],
  rawFlags: ["-O2", "-g0", "-Wall"],
  encoding: "eucjp",
} as const;

export const ASPSX_VERSIONS = ["2.77", "2.81"] as const;
export const SOURCE_ENCODINGS = ["utf8", "eucjp"] as const;

export function startsWithList(
  list: readonly string[],
  prefix: readonly string[],
): boolean {
  return (
    list.length >= prefix.length &&
    prefix.every((value, index) => list[index] === value)
  );
}

export function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && startsWithList(a, b);
}

export const CompilerSettingsSchema = z
  .strictObject({
    // Passed to both the compiler and the assembler; never -G in rawFlags.
    gpSize: z.union([z.literal(0), z.literal(8)]),
    aspsxVersion: z.enum(ASPSX_VERSIONS),
    rawFlags: z.array(z.string().min(1)),
    cppFlags: z.array(z.string().min(1)),
    encoding: z.enum(SOURCE_ENCODINGS),
    filename: z
      .string()
      .regex(
        /^[A-Za-z0-9_][A-Za-z0-9_.-]*\.c$/,
        "Expected a plain C file name.",
      ),
    // OSP-authored headers only; keys are virtual paths.
    headers: z.record(RelativePathSchema, z.string()),
    // Whole upstream files, fetched at runtime.
    remoteHeaders: z
      .record(RelativePathSchema, RemoteCReferenceSchema)
      .optional(),
  })
  .superRefine((compiler, ctx) => {
    if (!startsWithList(compiler.cppFlags, PSYQ_WASM_DEFAULT_CPP_FLAGS)) {
      ctx.addIssue({
        code: "custom",
        path: ["cppFlags"],
        message:
          "cppFlags must start with psyq-wasm's default preprocessor flags, because a supplied list replaces them.",
      });
    }
    compiler.rawFlags.forEach((flag, index) => {
      if (flag.startsWith("-G")) {
        ctx.addIssue({
          code: "custom",
          path: ["rawFlags", index],
          message: "Set gpSize instead of passing -G in rawFlags.",
        });
      }
    });
    for (const [key, reference] of Object.entries(
      compiler.remoteHeaders ?? {},
    )) {
      if (Object.hasOwn(compiler.headers, key)) {
        ctx.addIssue({
          code: "custom",
          path: ["remoteHeaders", key],
          message: "A header key cannot be both authored and remote.",
        });
      }
      if (reference.lines !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["remoteHeaders", key, "lines"],
          message:
            "A remote context header is a whole file and takes no line span.",
        });
      }
    }
  });
export type CompilerSettings = z.infer<typeof CompilerSettingsSchema>;

type IssuePath = readonly (string | number)[];

/**
 * Reports compiler settings that differ from upstream's default game build,
 * which every real function is compiled with. Issue paths start at
 * `compiler`, and `subject` names what is checked, such as "Real missions".
 */
export function checkUpstreamBuild(
  compiler: CompilerSettings,
  subject: string,
  report: (path: IssuePath, message: string) => void,
): void {
  if (Object.keys(compiler.headers).length > 0) {
    report(
      ["compiler", "headers"],
      `${subject} load all context remotely and carry no authored headers.`,
    );
  }
  if (compiler.aspsxVersion !== UPSTREAM_DEFAULT_BUILD.aspsxVersion) {
    report(
      ["compiler", "aspsxVersion"],
      `${subject} use aspsxVersion "2.77", the assembler of upstream's default build.`,
    );
  }
  if (!sameList(compiler.cppFlags, UPSTREAM_DEFAULT_BUILD.cppFlags)) {
    report(
      ["compiler", "cppFlags"],
      `${subject} use exactly the preprocessor flags of upstream's default build.`,
    );
  }
  if (!sameList(compiler.rawFlags, UPSTREAM_DEFAULT_BUILD.rawFlags)) {
    report(
      ["compiler", "rawFlags"],
      `${subject} use exactly the compiler flags of upstream's default build.`,
    );
  }
  if (compiler.encoding !== UPSTREAM_DEFAULT_BUILD.encoding) {
    report(
      ["compiler", "encoding"],
      `${subject} use encoding "eucjp", like upstream's default build.`,
    );
  }
}

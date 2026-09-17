import type {
  AssembledObject,
  BuildOutcome,
  CompilationInput,
  CompilerDiagnostic,
  ToolchainService,
} from "../compiler/types";
import {
  readDeclarations,
  type MemberKind,
  type TypeDeclaration,
} from "./declarations";

/**
 * Field offsets computed by the pinned compiler. This is compilation, not
 * execution: OSP generates C whose initializers are each field's offset and
 * size, builds it against the mission's resolved headers, and reads the
 * assembled data words. Results are view state only; they are never saved,
 * exported, cached, or reported.
 */

/** The data symbol the generated probe defines. */
export const PROBE_SYMBOL = "__osp_offset_probe";

export interface FieldLayout {
  readonly name: string;
  readonly offset: number;
  readonly size: number;
  readonly typeText: string;
  readonly kind: MemberKind;
}

export type TypeLayout =
  | {
      readonly kind: "measured";
      readonly name: string;
      readonly size: number;
      readonly fields: readonly FieldLayout[];
    }
  | {
      readonly kind: "unavailable";
      readonly name: string;
      readonly reason: string;
    };

export type ProbeOutcome =
  | { readonly kind: "measured"; readonly types: readonly TypeLayout[] }
  | {
      readonly kind: "failed";
      readonly message: string;
      readonly diagnostics: readonly CompilerDiagnostic[];
    }
  | { readonly kind: "cancelled" };

/** An `int` initializer list: each type's size, then each field's offset and size. */
export function probeSource(
  starterSource: string,
  declarations: readonly TypeDeclaration[],
): string {
  const values = declarations.flatMap((declaration) => {
    if (declaration.kind !== "declared") {
      return [];
    }
    const type = declaration.name;
    const member = (name: string) => `((${type} *)0)->${name}`;
    return [
      `(int)sizeof(${type})`,
      ...declaration.members.flatMap(({ name }) => [
        `(int)&${member(name)}`,
        `(int)sizeof(${member(name)})`,
      ]),
    ];
  });
  return `${starterSource}\nint ${PROBE_SYMBOL}[] = {\n    ${values.join(",\n    ")}\n};\n`;
}

/** The probe's words, read little-endian from the section holding its symbol. */
export function probeWords(
  object: AssembledObject,
  count: number,
): Int32Array | undefined {
  const symbol = object.symbols.find((entry) => entry.name === PROBE_SYMBOL);
  const section = object.sections.find(
    (entry) => entry.name === symbol?.section,
  );
  const start = symbol?.offset;
  if (start === undefined || section === undefined) {
    return undefined;
  }
  if (section.bytes.byteLength < start + count * 4) {
    return undefined;
  }
  const view = new DataView(
    section.bytes.buffer,
    section.bytes.byteOffset,
    section.bytes.byteLength,
  );
  return Int32Array.from({ length: count }, (_, index) =>
    view.getInt32(start + index * 4, true),
  );
}

function layouts(
  declarations: readonly TypeDeclaration[],
  words: Int32Array,
): TypeLayout[] {
  const values = words.values();
  const take = () => Number(values.next().value);
  return declarations.map((declaration) => {
    if (declaration.kind !== "declared") {
      return { ...declaration };
    }
    const size = take();
    return {
      kind: "measured",
      name: declaration.name,
      size,
      fields: declaration.members.map((member) => ({
        ...member,
        offset: take(),
        size: take(),
      })),
    };
  });
}

function wordCount(declarations: readonly TypeDeclaration[]): number {
  return declarations.reduce(
    (count, declaration) =>
      declaration.kind === "declared"
        ? count + 1 + declaration.members.length * 2
        : count,
    0,
  );
}

function failure(outcome: BuildOutcome, stage: string): ProbeOutcome {
  switch (outcome.kind) {
    case "cancelled":
      return { kind: "cancelled" };
    case "compiler-failure":
      return {
        kind: "failed",
        message: `The ${stage} did not compile.`,
        diagnostics: outcome.diagnostics,
      };
    case "assembler-failure":
      return {
        kind: "failed",
        message: `The ${stage} did not assemble.`,
        diagnostics: [],
      };
    case "timeout":
      return {
        kind: "failed",
        message: `The ${stage} took too long to compile.`,
        diagnostics: [],
      };
    case "infrastructure-failure":
      return { kind: "failed", message: outcome.message, diagnostics: [] };
    case "success":
      return {
        kind: "failed",
        message: `The ${stage} produced no offsets.`,
        diagnostics: [],
      };
  }
}

/**
 * Measures each named type: one build of the starter for its preprocessed
 * declarations, then one build of the generated probe. Both use the resolved
 * input, so the probe sees exactly the headers the player's build sees.
 */
export async function runOffsetProbe(
  toolchain: Pick<ToolchainService, "build">,
  input: CompilationInput,
  starterSource: string,
  typeNames: readonly string[],
  signal?: AbortSignal,
): Promise<ProbeOutcome> {
  const starter = await toolchain.build(
    { ...input, source: starterSource },
    signal,
  );
  if (starter.kind !== "success" || starter.preprocessed === undefined) {
    return failure(starter, "starting source");
  }
  const text = new TextDecoder(
    input.encoding === "eucjp" ? "euc-jp" : "utf-8",
  ).decode(starter.preprocessed);
  const declarations = readDeclarations(text, typeNames);
  const count = wordCount(declarations);
  if (count === 0) {
    return { kind: "measured", types: layouts(declarations, new Int32Array()) };
  }

  const probe = await toolchain.build(
    { ...input, source: probeSource(starterSource, declarations) },
    signal,
  );
  const words =
    probe.kind === "success" ? probeWords(probe.object, count) : undefined;
  return words === undefined
    ? failure(probe, "offset probe")
    : { kind: "measured", types: layouts(declarations, words) };
}

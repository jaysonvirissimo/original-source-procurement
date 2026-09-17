import { vi } from "vitest";
import { assembledObject } from "../../test/fakeToolchain";
import type {
  AssembledObject,
  BuildOutcome,
  CompilationInput,
  ToolchainService,
} from "../compiler/types";
import { PROBE_SYMBOL } from "./offsetProbe";

// OSP-authored test doubles for the offset probe.

/** An object whose data section holds `values` at the probe symbol. */
export function probeObject(
  values: readonly number[],
  offset = 0,
): AssembledObject {
  const bytes = new Uint8Array(offset + values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => {
    view.setInt32(offset + index * 4, value, true);
  });
  const object = assembledObject([]);
  return {
    ...object,
    sections: [
      ...object.sections,
      {
        name: ".data",
        kind: "data",
        bytes,
        size: bytes.length,
        relocations: [],
      },
    ],
    symbols: [
      { name: PROBE_SYMBOL, binding: "global", section: ".data", offset },
    ],
  };
}

/**
 * A build that answers `starterSource` with `preprocessed` output, the probe
 * with `values`, and any other source with `other`.
 */
export function probeBuild(
  starterSource: string,
  preprocessed: string,
  values: readonly number[],
  other: BuildOutcome = { kind: "cancelled" },
) {
  return vi.fn<ToolchainService["build"]>(
    (input: CompilationInput, signal?: AbortSignal) => {
      if (signal?.aborted === true) {
        return Promise.resolve({ kind: "cancelled" });
      }
      if (input.source.includes(PROBE_SYMBOL)) {
        return Promise.resolve({
          kind: "success",
          object: probeObject(values),
          compilerText: "",
          diagnostics: [],
        });
      }
      if (input.source === starterSource) {
        return Promise.resolve({
          kind: "success",
          object: assembledObject([]),
          compilerText: "",
          diagnostics: [],
          preprocessed: new TextEncoder().encode(preprocessed),
        });
      }
      return Promise.resolve(other);
    },
  );
}

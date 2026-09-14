import { PSYQ_WASM_DEFAULT_CPP_FLAGS } from "@osp/mission-schema";
import type { CompilationInput } from "../compiler/types";

export const CHECK_SOURCE = "int f(int a) { return a + 5; }\n";

/** Fixed settings for the toolchain check: PsyQ 4.4 defaults, no headers. */
export function checkInput(source: string): CompilationInput {
  return {
    filename: "check.c",
    source,
    headers: {},
    cppFlags: PSYQ_WASM_DEFAULT_CPP_FLAGS,
    rawFlags: ["-O2", "-g0", "-Wall"],
    gpSize: 0,
    aspsxVersion: "2.77",
    encoding: "utf8",
  };
}

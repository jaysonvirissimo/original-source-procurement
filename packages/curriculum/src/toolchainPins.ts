/**
 * The toolchain every generated target must come from.
 *
 * The game pins the same versions as dependencies, and a build test holds the
 * two in step. Bumping either one means regenerating every synthetic target
 * with `pnpm curriculum:targets`; until then validation fails.
 */
export const TOOLCHAIN_PINS = {
  psyqWasmVersion: "1.0.0",
  psyqAsmVersion: "0.2.0",
} as const;

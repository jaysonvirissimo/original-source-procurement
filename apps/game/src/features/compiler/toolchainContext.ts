import { createContext, useContext } from "react";
import type { ToolchainService } from "./types";

export type ToolchainState =
  | { readonly status: "idle" }
  | { readonly status: "starting" }
  | { readonly status: "ready"; readonly service: ToolchainService }
  | { readonly status: "failed"; readonly message: string };

export interface ToolchainContextValue {
  readonly state: ToolchainState;
  /**
   * Starts the session's toolchain if it is idle, or retries after a failed
   * start. Does nothing while starting or once ready.
   */
  readonly start: () => void;
}

export const ToolchainContext = createContext<
  ToolchainContextValue | undefined
>(undefined);

export function useToolchain(): ToolchainContextValue {
  const value = useContext(ToolchainContext);
  if (value === undefined) {
    throw new Error("useToolchain must be used inside a ToolchainProvider.");
  }
  return value;
}

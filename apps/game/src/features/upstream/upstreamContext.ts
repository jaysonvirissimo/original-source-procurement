import { createContext, useContext } from "react";
import type { UpstreamService } from "./types";

/**
 * Makes no requests: every load reports its content unavailable. Training
 * missions never load upstream content, so they are unaffected.
 */
export const offlineUpstream: UpstreamService = {
  loadTarget: () => Promise.resolve({ kind: "unavailable", attempts: [] }),
  loadC: () => Promise.resolve({ kind: "unavailable", attempts: [] }),
  clearCache: () => Promise.resolve(),
};

export const UpstreamContext = createContext<UpstreamService>(offlineUpstream);

export function useUpstream(): UpstreamService {
  return useContext(UpstreamContext);
}

import { useMemo, type ReactElement, type ReactNode } from "react";
import { useUpstreamCache } from "../persistence/progressContext";
import type { UpstreamCacheStore } from "../persistence/types";
import type { UpstreamService } from "./types";
import { UpstreamContext } from "./upstreamContext";

interface UpstreamProviderProps {
  readonly createUpstream: (cache: UpstreamCacheStore) => UpstreamService;
  readonly children: ReactNode;
}

/**
 * Provides an upstream service over the loaded storage's cache, so clearing
 * downloaded game data or resetting progress clears what the service reads.
 * Must sit inside `PersistenceProvider`.
 */
export function UpstreamProvider({
  createUpstream,
  children,
}: UpstreamProviderProps): ReactElement {
  const cache = useUpstreamCache();
  const upstream = useMemo(
    () => createUpstream(cache),
    [createUpstream, cache],
  );
  return <UpstreamContext value={upstream}>{children}</UpstreamContext>;
}

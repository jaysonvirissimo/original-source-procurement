import {
  createContext,
  use,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  IDLE_PRESENTATION,
  type MissionTier,
  type VrPhase,
  type WorkspacePresentation,
} from "./presentation";

export type PublishPresentation = (
  presentation: WorkspacePresentation | undefined,
) => void;

export const WorkspacePresentationContext =
  createContext<WorkspacePresentation>(IDLE_PRESENTATION);

// Without a provider, publishing does nothing.
export const PublishPresentationContext = createContext<PublishPresentation>(
  () => undefined,
);

export function useWorkspacePresentation(): WorkspacePresentation {
  return use(WorkspacePresentationContext);
}

/** Publishes a workspace's phase and tier until the workspace unmounts. */
export function usePublishPresentation(
  phase: VrPhase,
  missionTier: MissionTier,
): void {
  const publish = use(PublishPresentationContext);
  const presentation = useMemo(
    () => ({ phase, missionTier }),
    [phase, missionTier],
  );
  useEffect(() => {
    publish(presentation);
  }, [publish, presentation]);
  useEffect(
    () => () => {
      publish(undefined);
    },
    [publish],
  );
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

let cachedQuery:
  | {
      readonly matchMedia: typeof window.matchMedia;
      readonly list: MediaQueryList;
    }
  | undefined;

// Reading and listening use one MediaQueryList. WebKit fires change events
// against each list's own last value, and a list created during page load can
// hold a stale one, so a separate list could miss the next change.
function reducedMotionQuery(): MediaQueryList | undefined {
  if (typeof window.matchMedia !== "function") {
    return undefined;
  }
  // Kept only to notice a replaced matchMedia, never called unbound.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const matchMedia = window.matchMedia;
  if (cachedQuery?.matchMedia !== matchMedia) {
    cachedQuery = {
      matchMedia,
      list: window.matchMedia(REDUCED_MOTION_QUERY),
    };
  }
  return cachedQuery.list;
}

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = reducedMotionQuery();
  query?.addEventListener("change", onChange);
  return () => {
    query?.removeEventListener("change", onChange);
  };
}

/** Whether the browser asks for reduced motion. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => reducedMotionQuery()?.matches ?? false,
    () => false,
  );
}

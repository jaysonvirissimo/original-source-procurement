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

function reducedMotionQuery(): MediaQueryList | undefined {
  return typeof window.matchMedia === "function"
    ? window.matchMedia(REDUCED_MOTION_QUERY)
    : undefined;
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

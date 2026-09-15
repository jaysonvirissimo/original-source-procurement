import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";
import { usePlayerProgress } from "../features/persistence/progressContext";
import { presentationState } from "./presentation";
import {
  usePrefersReducedMotion,
  useWorkspacePresentation,
} from "./presentationContext";
import styles from "./PresentationLayer.module.css";
import { sceneColors } from "./sceneTokens";
import { frameLoop, pixelRatio, webglAvailable } from "./vrQuality";

// Three.js loads in its own chunk, only when the background is drawn.
const VrCanvas = lazy(() => import("./VrCanvas"));

interface PresentationLayerProps {
  /** Whether WebGL can start. Replaced in tests. */
  readonly canUseWebgl?: () => boolean;
}

/**
 * The decorative training-chamber background. It draws nothing in simple
 * graphics mode, without WebGL, or after the renderer fails, leaving the flat
 * grid behind the page. It also marks the page when motion is reduced.
 */
export function PresentationLayer({
  canUseWebgl = webglAvailable,
}: PresentationLayerProps): ReactElement | null {
  const { state: player } = usePlayerProgress();
  const workspace = useWorkspacePresentation();
  const prefersReducedMotion = usePrefersReducedMotion();
  const hidden = useDocumentHidden();
  const { phase, missionTier, reducedMotion, quality } = presentationState(
    workspace,
    player.settings,
    prefersReducedMotion,
  );
  const state = useMemo(
    () => ({ phase, missionTier, reducedMotion, quality }),
    [phase, missionTier, reducedMotion, quality],
  );
  const colors = useMemo(
    () =>
      quality === "full"
        ? sceneColors(getComputedStyle(document.documentElement))
        : undefined,
    [quality],
  );
  const drawn = useMemo(
    () => colors !== undefined && canUseWebgl(),
    [colors, canUseWebgl],
  );

  useEffect(() => {
    const root = document.documentElement;
    if (reducedMotion) {
      root.dataset.motion = "reduced";
    }
    return () => {
      delete root.dataset.motion;
    };
  }, [reducedMotion]);

  if (!drawn || colors === undefined) {
    return null;
  }
  const loop = frameLoop({ hidden, reducedMotion });
  return (
    <div
      className={styles.layer}
      aria-hidden="true"
      data-vr-layer=""
      data-vr-phase={phase}
      data-vr-tier={missionTier}
      data-vr-motion={reducedMotion ? "reduced" : "full"}
      data-vr-frameloop={loop}
    >
      <VrErrorBoundary>
        <Suspense fallback={null}>
          <VrCanvas
            state={state}
            colors={colors}
            frameloop={loop}
            dpr={pixelRatio(window.devicePixelRatio)}
          />
        </Suspense>
      </VrErrorBoundary>
    </div>
  );
}

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => {
    document.removeEventListener("visibilitychange", onChange);
  };
}

function useDocumentHidden(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.hidden,
    () => false,
  );
}

interface VrErrorBoundaryState {
  readonly failed: boolean;
}

/** A renderer failure removes the background and never reaches the game. */
class VrErrorBoundary extends Component<
  { readonly children: ReactNode },
  VrErrorBoundaryState
> {
  override state: VrErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): VrErrorBoundaryState {
    return { failed: true };
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

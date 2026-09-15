import { useState, type ReactElement, type ReactNode } from "react";
import { IDLE_PRESENTATION, type WorkspacePresentation } from "./presentation";
import {
  PublishPresentationContext,
  WorkspacePresentationContext,
} from "./presentationContext";

/** Holds what the open workspace shows the decorative background. */
export function PresentationProvider({
  children,
}: {
  readonly children: ReactNode;
}): ReactElement {
  const [published, setPublished] = useState<WorkspacePresentation>();
  return (
    <PublishPresentationContext value={setPublished}>
      <WorkspacePresentationContext value={published ?? IDLE_PRESENTATION}>
        {children}
      </WorkspacePresentationContext>
    </PublishPresentationContext>
  );
}

import { useCallback, useEffect, useRef } from "react";

export const SOURCE_SAVE_DELAY_MS = 750;

/**
 * Saves `source` once it has stopped changing for `delayMs`, and at once
 * when the page is hidden or the caller unmounts. Nothing is saved while
 * `source` is undefined, or when it matches what was last saved.
 */
export function useSourceAutosave(
  source: string | undefined,
  save: (source: string) => void,
  delayMs: number = SOURCE_SAVE_DELAY_MS,
): void {
  const latest = useRef({ source, save });
  const written = useRef(source);

  useEffect(() => {
    latest.current = { source, save };
  });

  const flush = useCallback(() => {
    const { source: current, save: write } = latest.current;
    if (current !== undefined && current !== written.current) {
      written.current = current;
      write(current);
    }
  }, []);

  useEffect(() => {
    if (source === undefined) {
      return;
    }
    const timer = setTimeout(flush, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [source, delayMs, flush]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flush();
    };
  }, [flush]);
}

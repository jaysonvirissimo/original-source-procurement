import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { ToolchainContext, type ToolchainState } from "./toolchainContext";
import type { ToolchainService } from "./types";

interface ToolchainProviderProps {
  readonly createToolchain: () => Promise<ToolchainService>;
  readonly children: ReactNode;
}

/**
 * Owns the one toolchain service of the app session. Nothing starts until a
 * screen asks for it, and the service is reused until the provider unmounts.
 */
export function ToolchainProvider({
  createToolchain,
  children,
}: ToolchainProviderProps): ReactElement {
  const [state, setState] = useState<ToolchainState>({ status: "idle" });
  const service = useRef<ToolchainService | undefined>(undefined);
  const starting = useRef(false);
  const unmounted = useRef(false);

  const start = useCallback(() => {
    if (starting.current || service.current !== undefined) {
      return;
    }
    starting.current = true;
    setState({ status: "starting" });

    createToolchain().then(
      (created) => {
        starting.current = false;
        if (unmounted.current) {
          created.dispose();
          return;
        }
        service.current = created;
        setState({ status: "ready", service: created });
      },
      (error: unknown) => {
        starting.current = false;
        if (!unmounted.current) {
          setState({
            status: "failed",
            message:
              error instanceof Error
                ? error.message
                : "The compiler did not start.",
          });
        }
      },
    );
  }, [createToolchain]);

  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      service.current?.dispose();
      service.current = undefined;
    };
  }, []);

  const value = useMemo(() => ({ state, start }), [state, start]);

  return <ToolchainContext value={value}>{children}</ToolchainContext>;
}

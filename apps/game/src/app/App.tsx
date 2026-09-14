import type { ReactElement } from "react";
import { createBrowserToolchain } from "../features/compiler/browserToolchain";
import { ToolchainProvider } from "../features/compiler/ToolchainProvider";
import type { ToolchainService } from "../features/compiler/types";
import { ToolchainPanel } from "../features/settings/ToolchainPanel";
import { HomeRoute } from "../routes/HomeRoute";
import type { Route } from "../routes/parseRoute";
import { RoutePanel } from "../routes/RoutePanel";
import { useHashRoute } from "../routes/useHashRoute";
import styles from "./App.module.css";

interface AppProps {
  readonly createToolchain?: () => Promise<ToolchainService>;
}

export function App({
  createToolchain = createBrowserToolchain,
}: AppProps): ReactElement {
  const route = useHashRoute();

  return (
    <ToolchainProvider createToolchain={createToolchain}>
      <div className={styles.shell}>
        <main className={styles.main}>
          <RouteView route={route} />
        </main>
        <footer className={styles.footer}>
          <a className={styles.footerLink} href="./THIRD_PARTY_NOTICES.txt">
            Third-party notices
          </a>
        </footer>
      </div>
    </ToolchainProvider>
  );
}

interface RouteViewProps {
  readonly route: Route;
}

export function RouteView({ route }: RouteViewProps): ReactElement {
  switch (route.kind) {
    case "home":
      return <HomeRoute />;
    case "mission":
      return (
        <RoutePanel
          title="Mission"
          detail={route.missionId}
          message="Missions are not available yet."
        />
      );
    case "manual":
      return (
        <RoutePanel
          title="Manual"
          detail={route.entryId}
          message="The manual is not available yet."
        />
      );
    case "settings":
      return (
        <RoutePanel
          title="Settings"
          message="Other settings are not available yet."
        >
          <ToolchainPanel />
        </RoutePanel>
      );
    case "not-found":
      return (
        <RoutePanel
          title="Route not found"
          detail={route.path}
          message="No screen exists at this address."
        />
      );
  }
}

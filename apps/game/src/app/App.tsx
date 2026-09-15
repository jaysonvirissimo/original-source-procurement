import type { ReactElement } from "react";
import { createBrowserToolchain } from "../features/compiler/browserToolchain";
import { ToolchainProvider } from "../features/compiler/ToolchainProvider";
import type { ToolchainService } from "../features/compiler/types";
import {
  MissionCatalogContext,
  shippedCatalog,
  type MissionCatalog,
} from "../features/curriculum/missionCatalog";
import { openBrowserStorage } from "../features/persistence/indexedDbPersistence";
import { PersistenceProvider } from "../features/persistence/PersistenceProvider";
import { SaveNotices } from "../features/persistence/SaveNotices";
import type { BrowserStorage } from "../features/persistence/types";
import { SaveDataPanel } from "../features/settings/SaveDataPanel";
import { ScaffoldSettingPanel } from "../features/settings/ScaffoldSettingPanel";
import { ToolchainPanel } from "../features/settings/ToolchainPanel";
import type { UpstreamService } from "../features/upstream/types";
import {
  offlineUpstream,
  UpstreamContext,
} from "../features/upstream/upstreamContext";
import { HomeRoute } from "../routes/HomeRoute";
import { MissionRoute } from "../routes/MissionRoute";
import type { Route } from "../routes/parseRoute";
import { RoutePanel } from "../routes/RoutePanel";
import { useHashRoute } from "../routes/useHashRoute";
import styles from "./App.module.css";

// A stable function, so the provider opens storage once.
const openDefaultStorage = () => openBrowserStorage();

interface AppProps {
  readonly createToolchain?: () => Promise<ToolchainService>;
  readonly catalog?: MissionCatalog;
  readonly upstream?: UpstreamService;
  readonly openStorage?: () => Promise<BrowserStorage>;
}

export function App({
  createToolchain = createBrowserToolchain,
  catalog = shippedCatalog,
  upstream = offlineUpstream,
  openStorage = openDefaultStorage,
}: AppProps): ReactElement {
  const route = useHashRoute();

  return (
    <ToolchainProvider createToolchain={createToolchain}>
      <MissionCatalogContext value={catalog}>
        <UpstreamContext value={upstream}>
          <div className={styles.shell}>
            <main className={styles.main}>
              <PersistenceProvider openStorage={openStorage}>
                <SaveNotices />
                <RouteView route={route} />
              </PersistenceProvider>
            </main>
            <footer className={styles.footer}>
              <a className={styles.footerLink} href="./THIRD_PARTY_NOTICES.txt">
                Third-party notices
              </a>
            </footer>
          </div>
        </UpstreamContext>
      </MissionCatalogContext>
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
      return <MissionRoute missionId={route.missionId} />;
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
          message="Save data stays in this browser. Export it to keep a copy or move it to another browser."
        >
          <ScaffoldSettingPanel />
          <SaveDataPanel />
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

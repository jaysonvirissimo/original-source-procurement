import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("OSP could not find its root element.");
}

const root = createRoot(container);

// The fixtures build, used only by browser tests, adds an OSP-authored field
// mission. Production builds drop this branch and never contain the fixture.
if (import.meta.env.MODE === "fixtures") {
  void import("./test/fixtureCatalog").then(async ({ fixtureCatalog }) => {
    root.render(
      <StrictMode>
        <App catalog={await fixtureCatalog()} />
      </StrictMode>,
    );
  });
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

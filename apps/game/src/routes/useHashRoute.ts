import { useSyncExternalStore } from "react";
import { parseRoute, type Route } from "./parseRoute";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
  };
}

function readHash(): string {
  return window.location.hash;
}

export function useHashRoute(): Route {
  return parseRoute(useSyncExternalStore(subscribe, readHash));
}

export type Route =
  | { readonly kind: "home" }
  | { readonly kind: "mission"; readonly missionId: string }
  | { readonly kind: "manual"; readonly entryId: string }
  | { readonly kind: "settings" }
  | { readonly kind: "not-found"; readonly path: string };

/**
 * Parses a `location.hash` value into a route.
 *
 * Routes live entirely in the hash so that every address, including a
 * browser refresh, is served by the same static `index.html`.
 */
export function parseRoute(hash: string): Route {
  const path = hash.startsWith("#") ? hash.slice(1) : hash;

  let trimmed = path.startsWith("/") ? path.slice(1) : path;
  if (trimmed.endsWith("/")) {
    trimmed = trimmed.slice(0, -1);
  }

  if (trimmed === "") {
    return { kind: "home" };
  }

  const [head, param, ...rest] = trimmed.split("/");

  if (rest.length > 0) {
    return notFound(path);
  }

  if (head === "settings" && param === undefined) {
    return { kind: "settings" };
  }

  if (param === undefined || param === "") {
    return notFound(path);
  }

  const id = decodeSegment(param);

  if (id === undefined) {
    return notFound(path);
  }

  if (head === "mission") {
    return { kind: "mission", missionId: id };
  }

  if (head === "manual") {
    return { kind: "manual", entryId: id };
  }

  return notFound(path);
}

function notFound(path: string): Route {
  return { kind: "not-found", path };
}

function decodeSegment(segment: string): string | undefined {
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
}

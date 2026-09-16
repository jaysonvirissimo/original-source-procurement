import {
  SDK_HEADER_PREFIX,
  SDK_INCLUDE_PATH,
  type RemoteCReference,
} from "@osp/mission-schema";

/**
 * Where upstream's preprocessor looks for an angle include, in search order,
 * expressed as the virtual directories the mission's `-I` flags name.
 */
const SEARCH_PATHS = [SDK_HEADER_PREFIX, "source/", "source/include/"] as const;

const INCLUDE = /^[ \t]*#[ \t]*include[ \t]*([<"])([^>"\n]+)[>"]/gm;

export interface IncludeDirective {
  readonly name: string;
  /**
   * A quoted include is looked for beside the including file first; an angle
   * include only on the search path.
   */
  readonly quoted: boolean;
}

/** The include directives of one file, in order, with their form. */
export function includeDirectives(text: string): IncludeDirective[] {
  return [...text.matchAll(INCLUDE)].map((match) => {
    const directive = match[0];
    const open = directive.search(/[<"]/);
    return {
      name: directive.slice(open + 1, -1),
      quoted: directive[open] === '"',
    };
  });
}

/** Collapses `.` and `..` segments; a path that escapes the root is empty. */
export function normalizePath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.pop() === undefined) return "";
      continue;
    }
    segments.push(segment);
  }
  return segments.join("/");
}

/** A path's directory with its trailing slash, or "" for a bare file name. */
export function directoryOf(path: string): string {
  return path.slice(0, path.lastIndexOf("/") + 1);
}

/**
 * The upstream file a virtual header path stands for.
 *
 * The compiled source sits at the virtual root, standing for its own upstream
 * directory, so a virtual path that is neither an SDK header nor an upstream
 * path is a header beside the compiled file.
 */
export function upstreamFileOf(
  virtualPath: string,
  sourceDirectory: string,
): { repository: RemoteCReference["repository"]; path: string } {
  if (virtualPath.startsWith(SDK_HEADER_PREFIX)) {
    return {
      repository: "FoxdieTeam/psyq_sdk",
      path: SDK_INCLUDE_PATH + virtualPath.slice(SDK_HEADER_PREFIX.length),
    };
  }
  return {
    repository: "FoxdieTeam/mgs_reversing",
    path: virtualPath.startsWith("source/")
      ? virtualPath
      : sourceDirectory + virtualPath,
  };
}

/** Reads a file from a pinned checkout, or `undefined` when it is absent. */
export type ReadUpstream = (
  repository: RemoteCReference["repository"],
  path: string,
) => Promise<Uint8Array | undefined>;

export interface ClosureEntry {
  /** The virtual path the compiler resolves, and the `remoteHeaders` key. */
  readonly key: string;
  readonly repository: RemoteCReference["repository"];
  readonly path: string;
  readonly bytes: Uint8Array;
}

/**
 * Every header the compiled source can reach, resolved the way upstream's
 * preprocessor resolves them.
 *
 * Conditional compilation is deliberately ignored, so the result is a
 * superset of what one build reads. That is what a mission needs: the set
 * must be closed, and a header the build skips costs nothing. A directive
 * that resolves to no file in either checkout is skipped, because it is
 * usually guarded by a condition upstream's default build never takes.
 */
export async function includeClosure(
  sourcePath: string,
  sourceText: string,
  read: ReadUpstream,
): Promise<ClosureEntry[]> {
  const sourceDirectory = directoryOf(sourcePath);
  const found = new Map<string, ClosureEntry>();
  const missing = new Set<string>();
  const decoder = new TextDecoder();

  const pending: { directory: string; text: string }[] = [
    { directory: "", text: sourceText },
  ];

  while (pending.length > 0) {
    const { directory, text } = pending.pop() as {
      directory: string;
      text: string;
    };
    for (const { name, quoted } of includeDirectives(text)) {
      const candidates = quoted
        ? [directory + name, ...SEARCH_PATHS.map((prefix) => prefix + name)]
        : SEARCH_PATHS.map((prefix) => prefix + name);

      for (const candidate of candidates) {
        const key = normalizePath(candidate);
        if (key === "" || missing.has(key)) continue;
        if (found.has(key)) break;

        const file = upstreamFileOf(key, sourceDirectory);
        const bytes = await read(file.repository, file.path);
        if (bytes === undefined) {
          missing.add(key);
          continue;
        }
        found.set(key, { key, ...file, bytes });
        pending.push({
          directory: directoryOf(key),
          text: decoder.decode(bytes),
        });
        break;
      }
    }
  }

  return [...found.values()].sort((a, b) => a.key.localeCompare(b.key));
}

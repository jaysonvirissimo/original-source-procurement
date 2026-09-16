import type { GitDeletion } from "./checkout.ts";
import { basenameOf } from "./inventory.ts";

/** Where and when an assembly file was removed from the tree. */
export interface Deletion {
  /** The commit that removed it. Its parent still has the file. */
  readonly commit: string;
  readonly path: string;
}

/**
 * Deletions by file name, newest first.
 *
 * A file name is the key rather than the path because upstream has moved and
 * regrouped its assembly directories many times; the name has stayed stable.
 * The newest deletion wins, so a file that was moved and later deleted pins
 * the deletion that matched the function, not the move.
 */
export function deletionsByName(
  log: readonly GitDeletion[],
): Map<string, Deletion[]> {
  const byName = new Map<string, Deletion[]>();
  for (const { commit, paths } of log) {
    for (const path of paths) {
      if (!path.endsWith(".s")) continue;
      const name = basenameOf(path);
      const deletions = byName.get(name);
      if (deletions === undefined) {
        byName.set(name, [{ commit, path }]);
      } else {
        deletions.push({ commit, path });
      }
    }
  }
  return byName;
}

/** The newest deletion of any of these file names. */
export function newestDeletion(
  byName: ReadonlyMap<string, readonly Deletion[]>,
  names: readonly string[],
): Deletion | undefined {
  for (const name of names) {
    const deletion = byName.get(name)?.[0];
    if (deletion !== undefined) return deletion;
  }
  return undefined;
}

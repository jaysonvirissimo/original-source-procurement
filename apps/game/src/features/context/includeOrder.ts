// The name between the quotes or angle brackets, which is never empty.
const INCLUDE = /^[ \t]*#[ \t]*include[ \t]*[<"]([^>"]+)[>"]/gm;

/** The paths a C text includes, in the order it names them. */
export function includedNames(text: string): string[] {
  return Array.from(text.matchAll(INCLUDE), ([, name]) => String(name));
}

/** The `-I` search directories, in order. */
function searchDirectories(cppFlags: readonly string[]): string[] {
  return cppFlags.flatMap((flag) =>
    flag.startsWith("-I") && flag.length > 2 ? [flag.slice(2)] : [],
  );
}

/**
 * Header keys in the order a reader meets them: depth first from the
 * starter's `#include` lines, resolving each name as the preprocessor would,
 * then any header nothing reached, by path. It reads only the header map it
 * is given and never fetches.
 */
export function includeOrder(
  starterSource: string,
  headers: Readonly<Record<string, string>>,
  cppFlags: readonly string[],
): string[] {
  const directories = searchDirectories(cppFlags);
  const entries = new Map(Object.entries(headers));
  const ordered: string[] = [];

  const visit = (text: string) => {
    for (const name of includedNames(text)) {
      for (const key of [name, ...directories.map((d) => `${d}/${name}`)]) {
        const header = entries.get(key);
        if (header !== undefined) {
          if (!ordered.includes(key)) {
            ordered.push(key);
            visit(header);
          }
          break;
        }
      }
    }
  };
  visit(starterSource);

  const unreached = [...entries.keys()]
    .filter((key) => !ordered.includes(key))
    .sort();
  return [...ordered, ...unreached];
}

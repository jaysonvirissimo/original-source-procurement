/**
 * Upstream's function inventory: one line per function in the default build,
 * as `ADDRESS SIZE NAME`, with the address and size in hexadecimal and
 * decimal respectively.
 */
export interface InventoryEntry {
  readonly symbol: string;
  readonly address: number;
  /** Size in bytes; a function's word count is a quarter of it. */
  readonly size: number;
}

const LINE = /^([0-9A-Fa-f]{8})[ \t]+(\d+)[ \t]+(\S+)$/;

/**
 * Parses `build/functions.txt`. Blank lines are ignored; a line that does not
 * carry an address, a size, and a symbol is a malformed inventory, not a
 * function to skip, so parsing fails loudly.
 */
export function parseInventory(text: string): InventoryEntry[] {
  const entries: InventoryEntry[] = [];
  for (const [index, line] of text.split("\n").entries()) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const match = LINE.exec(trimmed);
    if (match === null) {
      throw new Error(
        `functions.txt line ${String(index + 1)} is not "ADDRESS SIZE NAME".`,
      );
    }
    const [, address, size, symbol] = match as unknown as [
      string,
      string,
      string,
      string,
    ];
    entries.push({
      symbol,
      address: Number.parseInt(address, 16),
      size: Number.parseInt(size, 10),
    });
  }
  return entries;
}

/** The status the corpus records for an imported function. */
export type ImportStatus = "SOLVED" | "LIVE";

/**
 * The names upstream gives a function's assembly file: `<symbol>.s` when the
 * symbol already carries its address, and `<symbol>_<ADDRESS>.s` when it does
 * not. Both appear in history.
 */
export function assemblyNames(entry: InventoryEntry): readonly string[] {
  const address = entry.address.toString(16).toUpperCase().padStart(8, "0");
  return [`${entry.symbol}.s`, `${entry.symbol}_${address}.s`];
}

/** The last path segment. */
export function basenameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * A function with an assembly file in the pinned tree is still unmatched and
 * can only become a live mission; one without has been solved, and its target
 * lives in history.
 */
export function statusOf(
  entry: InventoryEntry,
  assemblyBasenames: ReadonlySet<string>,
): ImportStatus {
  return assemblyNames(entry).some((name) => assemblyBasenames.has(name))
    ? "LIVE"
    : "SOLVED";
}

import type { MemoryAccess, WordFacts } from "@osp/matching-core";
import type {
  ExampleCell,
  ExampleRegion,
  MissionExample,
} from "@osp/mission-schema";

export interface RegisterRow {
  readonly register: string;
  /** The example value at function entry, when the mission gives one. */
  readonly value?: number;
  readonly note?: string;
  readonly readBy: readonly number[];
  readonly writtenBy: readonly number[];
}

/**
 * Every register the target uses, with the words that read and write it:
 * the example's registers first, then the rest in order of first use.
 */
export function registerDiagram(
  facts: readonly WordFacts[],
  example: MissionExample | undefined,
): RegisterRow[] {
  const order = [
    ...new Set([
      ...(example?.registers ?? []).map(({ register }) => register),
      ...facts.flatMap(({ reads, writes }) => [...reads, ...writes]),
    ]),
  ];
  return order.map((register): RegisterRow => {
    const given = example?.registers.find(
      (entry) => entry.register === register,
    );
    return {
      register,
      ...(given === undefined ? {} : { value: given.value }),
      ...(given?.note === undefined ? {} : { note: given.note }),
      readBy: facts
        .filter(({ reads }) => reads.includes(register))
        .map(({ index }) => index),
      writtenBy: facts
        .filter(({ writes }) => writes.includes(register))
        .map(({ index }) => index),
    };
  });
}

export interface CellAccess {
  readonly index: number;
  readonly access: MemoryAccess;
}

export interface MemoryRow {
  readonly cell: ExampleCell;
  readonly address: number;
  readonly accesses: readonly CellAccess[];
}

export interface RegionDiagram {
  readonly label: string;
  readonly address: number;
  readonly rows: readonly MemoryRow[];
}

export interface MemoryDiagram {
  readonly regions: readonly RegionDiagram[];
  /** Accesses whose address the example does not lead to. */
  readonly unresolved: readonly CellAccess[];
}

interface Located {
  readonly region: ExampleRegion;
  readonly cell: ExampleCell;
}

/**
 * The example's memory with the target words that read and write each cell.
 * An address comes from a base register's example value at entry, or from a
 * pointer cell an earlier load read. Nothing executes: values are the
 * example's, never computed.
 */
export function memoryDiagram(
  facts: readonly WordFacts[],
  example: MissionExample,
): MemoryDiagram {
  const entry = new Map(
    example.registers.map(({ register, value }) => [register, value >>> 0]),
  );
  const regions = new Map(
    example.regions.map((region) => [region.label, region]),
  );
  const cellAt = (address: number): Located | undefined => {
    for (const region of example.regions) {
      const cell = region.cells.find(
        ({ offset }) => region.address + offset === address,
      );
      if (cell !== undefined) {
        return { region, cell };
      }
    }
    return undefined;
  };

  const located = new Map<number, Located | undefined>();
  const locate = (
    word: WordFacts,
    memory: MemoryAccess,
  ): Located | undefined => {
    if (located.has(word.index)) {
      return located.get(word.index);
    }
    let base: number | undefined;
    if (word.baseWrittenBy === undefined) {
      base = entry.get(memory.base);
    } else {
      // The base came from an earlier word: follow it only when that word
      // loaded a pointer cell the example names.
      const writer = facts[word.baseWrittenBy];
      const source =
        writer?.memory?.kind === "load"
          ? locate(writer, writer.memory)
          : undefined;
      const pointsTo = source?.cell.pointsTo;
      base =
        pointsTo === undefined ? undefined : regions.get(pointsTo)?.address;
    }
    const found = base === undefined ? undefined : cellAt(base + memory.offset);
    located.set(word.index, found);
    return found;
  };

  const cellsOf = new Map<ExampleCell, CellAccess[]>();
  const unresolved: CellAccess[] = [];
  for (const word of facts) {
    if (word.memory === undefined) {
      continue;
    }
    const access = { index: word.index, access: word.memory };
    const found = locate(word, word.memory);
    if (found === undefined) {
      unresolved.push(access);
    } else {
      cellsOf.set(found.cell, [...(cellsOf.get(found.cell) ?? []), access]);
    }
  }

  return {
    regions: example.regions.map((region) => ({
      label: region.label,
      address: region.address,
      rows: region.cells.map((cell) => ({
        cell,
        address: region.address + cell.offset,
        accesses: cellsOf.get(cell) ?? [],
      })),
    })),
    unresolved,
  };
}

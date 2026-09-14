import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { findCycle } from "./graph.ts";
import { dagArbitrary } from "./test-graphs.test-helpers.ts";

function graphOf(
  entries: readonly { node: string; edges: readonly string[] }[],
) {
  return new Map(entries.map(({ node, edges }) => [node, edges] as const));
}

describe("findCycle", () => {
  it("returns undefined for an empty or acyclic graph", () => {
    expect(findCycle(new Map())).toBeUndefined();
    expect(
      findCycle(
        new Map([
          ["C", ["B", "A"]],
          ["B", ["A"]],
          ["A", []],
        ]),
      ),
    ).toBeUndefined();
  });

  it("reports a self-loop", () => {
    expect(findCycle(new Map([["A", ["A"]]]))).toEqual(["A", "A"]);
  });

  it("reports a cycle as a closed path from the first node visited", () => {
    expect(
      findCycle(
        new Map([
          ["D", []],
          ["C", ["A"]],
          ["B", ["C"]],
          ["A", ["D", "B"]],
        ]),
      ),
    ).toEqual(["A", "B", "C", "A"]);
  });

  it("ignores edges to nodes outside the graph", () => {
    expect(findCycle(new Map([["A", ["MISSING"]]]))).toBeUndefined();
  });

  it("finds no cycle in any generated DAG", () => {
    fc.assert(
      fc.property(dagArbitrary(), (dag) => {
        expect(findCycle(graphOf(dag))).toBeUndefined();
      }),
    );
  });

  it("always reports a real cycle after adding a back edge", () => {
    fc.assert(
      fc.property(
        dagArbitrary().filter((dag) => dag.length >= 2),
        fc.nat(),
        fc.nat(),
        (dag, a, b) => {
          const high = 1 + (a % (dag.length - 1));
          const low = b % high;
          const graph = new Map(
            dag.map(({ node, edges }, i) => {
              if (i === high) {
                return [node, [...new Set([...edges, `N${String(low)}`])]];
              }
              if (i === low) {
                return [node, [...edges, `N${String(high)}`]];
              }
              return [node, edges];
            }),
          );

          const cycle = findCycle(graph);
          expect(cycle).toBeDefined();
          const path = cycle ?? [];
          expect(path.length).toBeGreaterThanOrEqual(2);
          expect(path[0]).toBe(path.at(-1));
          for (let i = 0; i + 1 < path.length; i += 1) {
            expect(graph.get(path[i] ?? "")).toContain(path[i + 1]);
          }
        },
      ),
    );
  });

  it("does not depend on insertion order", () => {
    fc.assert(
      fc.property(
        dagArbitrary(),
        fc.nat(),
        fc.nat(),
        fc.boolean(),
        (dag, a, b, addCycle) => {
          const entries = dag.map(({ node, edges }, i) => ({
            node,
            edges:
              addCycle && i === a % dag.length
                ? [...edges, `N${String(b % dag.length)}`]
                : edges,
          }));
          const shuffled = [...entries].reverse();
          expect(findCycle(graphOf(shuffled))).toEqual(
            findCycle(graphOf(entries)),
          );
        },
      ),
    );
  });
});

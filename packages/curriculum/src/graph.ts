import type { Mission, Skill } from "@osp/mission-schema";

/**
 * The skills a mission expects the player to have been taught already: what
 * it requires, what it practices without teaching, and the prerequisites of
 * what it teaches. Each skill appears once, in that order. Prerequisites of a
 * skill missing from `skillsById` are not known and are left out.
 */
export function missionNeeds(
  mission: Pick<Mission, "requires" | "teaches" | "practices">,
  skillsById: ReadonlyMap<string, Pick<Skill, "prerequisites">>,
): readonly string[] {
  return [
    ...new Set([
      ...mission.requires,
      ...mission.practices.filter((skill) => !mission.teaches.includes(skill)),
      ...mission.teaches.flatMap(
        (skill) => skillsById.get(skill)?.prerequisites ?? [],
      ),
    ]),
  ];
}

/**
 * Finds a cycle in a graph given as node → outgoing edges. Edges to nodes
 * outside the graph are ignored. Nodes are visited in sorted order, so the
 * result does not depend on the map's insertion order.
 *
 * Returns the cycle as a closed path (first and last node equal), or
 * `undefined` when the graph is acyclic.
 */
export function findCycle(
  graph: ReadonlyMap<string, readonly string[]>,
): readonly string[] | undefined {
  const done = new Set<string>();
  const roots = [...graph].sort(([a], [b]) => a.localeCompare(b, "en"));

  for (const [root, rootEdges] of roots) {
    if (done.has(root)) {
      continue;
    }
    const stack = [{ node: root, edges: rootEdges, next: 0 }];
    const onStack = new Set([root]);

    for (let frame = stack.at(-1); frame !== undefined; frame = stack.at(-1)) {
      const child = frame.edges[frame.next];
      if (child === undefined) {
        stack.pop();
        onStack.delete(frame.node);
        done.add(frame.node);
        continue;
      }
      frame.next += 1;

      const childEdges = graph.get(child);
      if (childEdges === undefined || done.has(child)) {
        continue;
      }
      if (onStack.has(child)) {
        const start = stack.findIndex((entry) => entry.node === child);
        return [...stack.slice(start).map((entry) => entry.node), child];
      }
      stack.push({ node: child, edges: childEdges, next: 0 });
      onStack.add(child);
    }
  }
  return undefined;
}

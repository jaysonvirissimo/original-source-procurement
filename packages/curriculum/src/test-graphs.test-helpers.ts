import fc from "fast-check";

/**
 * An acyclic graph over nodes N0..Nn-1 where edges only point to lower
 * indexes, so index order is a topological order.
 */
export function dagArbitrary(maxNodes = 10) {
  return fc.integer({ min: 1, max: maxNodes }).chain((size) =>
    fc
      .array(fc.array(fc.boolean(), { minLength: size, maxLength: size }), {
        minLength: size,
        maxLength: size,
      })
      .map((matrix) => {
        const nodes = Array.from({ length: size }, (_, i) => `N${String(i)}`);
        return nodes.map((node, i) => ({
          node,
          edges: nodes.filter((_, j) => j < i && matrix[i]?.[j] === true),
        }));
      }),
  );
}

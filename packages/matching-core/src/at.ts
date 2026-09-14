/** Reads an index the caller has already bounds-checked. */
export function at<T>(items: ArrayLike<T>, index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new RangeError(`Index ${String(index)} is out of range.`);
  }
  return item;
}

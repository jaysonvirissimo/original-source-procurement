/** Joins the class names that are present, skipping false and undefined. */
export function classNames(
  ...names: readonly (string | false | undefined)[]
): string {
  return names
    .filter((name): name is string => typeof name === "string" && name !== "")
    .join(" ");
}

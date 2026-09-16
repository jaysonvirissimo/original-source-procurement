/** A bit pattern as binary digits in groups of four, most significant first. */
export function bitGroups(value: number, width: number): string {
  const digits = (value >>> 0).toString(2).padStart(width, "0");
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

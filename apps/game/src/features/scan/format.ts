import type { MemoryAccess } from "@osp/matching-core";

/** An address or pointer as listings show it, such as `0x1000`. */
export function hex(value: number): string {
  return `0x${(value >>> 0).toString(16).toUpperCase()}`;
}

/** `word 2`, or `words 0, 3`; a dash when there are none. */
export function wordList(indexes: readonly number[]): string {
  if (indexes.length === 0) {
    return "—";
  }
  return `${indexes.length === 1 ? "word" : "words"} ${indexes.join(", ")}`;
}

/** What one instruction does with a cell, in words. */
export function accessText(index: number, access: MemoryAccess): string {
  const bytes = `${String(access.bytes)} ${access.bytes === 1 ? "byte" : "bytes"}`;
  if (access.kind === "store") {
    return `Word ${String(index)} stores ${bytes} from ${access.register}`;
  }
  const extension =
    access.bytes === 4
      ? ""
      : access.signed
        ? ", sign-extended"
        : ", zero-extended";
  return `Word ${String(index)} loads ${bytes} into ${access.register}${extension}`;
}

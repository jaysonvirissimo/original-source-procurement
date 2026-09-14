import { decode, format } from "psyq-asm";

/** Target words as instructions, formatted as match results format them. */
export function targetListing(words: ArrayLike<number>): string[] {
  return Array.from(words, (word) => format(decode(word), { pseudo: true }));
}

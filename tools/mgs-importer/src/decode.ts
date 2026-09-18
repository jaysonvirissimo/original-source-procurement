import { decodeWords, format } from "psyq-asm";

/**
 * A pinned target's words as instructions, one line per word, so a real
 * mission's hint ranges and its clean-room shape description can be drafted
 * from what the machine does rather than from the original C. The listing is
 * for the terminal only and is never written into the repository.
 */
export function renderDecodedTarget(
  symbol: string,
  words: readonly number[],
): string[] {
  const { instructions } = decodeWords(words);
  return [
    `${symbol}  (${String(words.length)} rows)`,
    ...instructions.map((instruction, index) => {
      const row = `  row ${String(index).padStart(3)}  `;
      if (instruction.mnemonic === ".word") {
        return `${row}.word 0x${instruction.word.toString(16).padStart(8, "0")}  ${instruction.reason}`;
      }
      const reads = instruction.reads.join(",");
      const writes = instruction.writes.join(",");
      return `${row}${format(instruction).padEnd(30)} reads[${reads}] writes[${writes}] hazard=${instruction.hazardClass}`;
    }),
  ];
}

import { decode, format, type AssembledObject } from "psyq-asm";
import type {
  AssemblerDiagnostic,
  BuildOutcome,
  CompilerDiagnostic,
} from "./types";

export interface OutcomeDescription {
  readonly tone: "neutral" | "success" | "warning" | "error";
  readonly summary: string;
  readonly diagnostics: readonly string[];
  /** One line per assembled `.text` word: offset, word, and instruction. */
  readonly listing: readonly string[];
}

export function formatDiagnostic(
  diagnostic: CompilerDiagnostic | AssemblerDiagnostic,
): string {
  const location = [diagnostic.file, diagnostic.line, diagnostic.column]
    .filter((part) => part !== undefined)
    .join(":");
  const prefix = location === "" ? "" : `${location}: `;
  return `${prefix}${diagnostic.severity}: ${diagnostic.message}`;
}

/** Lists the `.text` words with their offsets and decoded instructions. */
export function formatTextSection(object: AssembledObject): string[] {
  const text = object.sections.find((section) => section.name === ".text");
  return Array.from(text?.words ?? [], (word, index) =>
    [
      (index * 4).toString(16).padStart(4, "0"),
      word.toString(16).padStart(8, "0"),
      format(decode(word)),
    ].join("  "),
  );
}

export function describeOutcome(outcome: BuildOutcome): OutcomeDescription {
  switch (outcome.kind) {
    case "success": {
      const listing = formatTextSection(outcome.object);
      return {
        tone: "success",
        summary: `Compiled and assembled ${String(listing.length)} ${listing.length === 1 ? "word" : "words"}.`,
        diagnostics: outcome.diagnostics.map(formatDiagnostic),
        listing,
      };
    }
    case "compiler-failure":
      return {
        tone: "error",
        summary: "The compiler reported errors.",
        diagnostics: outcome.diagnostics.map(formatDiagnostic),
        listing: [],
      };
    case "assembler-failure":
      return {
        tone: "error",
        summary:
          "Toolchain error: the assembler rejected the compiler's output. This is a defect in the toolchain, not in the source.",
        diagnostics: outcome.diagnostics.map(formatDiagnostic),
        listing: [],
      };
    case "cancelled":
      return {
        tone: "neutral",
        summary: "Check cancelled.",
        diagnostics: [],
        listing: [],
      };
    case "timeout":
      return {
        tone: "warning",
        summary: `The compile ran longer than ${String(outcome.timeoutMs / 1000)} seconds and was stopped.`,
        diagnostics: [],
        listing: [],
      };
    case "infrastructure-failure":
      return {
        tone: "error",
        summary: `The toolchain failed to run: ${outcome.message}`,
        diagnostics: [],
        listing: [],
      };
  }
}

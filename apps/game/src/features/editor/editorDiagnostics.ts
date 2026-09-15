import type { Diagnostic } from "@codemirror/lint";
import type { Text } from "@codemirror/state";
import { diagnosticGuidance, likelyLine } from "../compiler/diagnosticGuidance";
import type { CompilerDiagnostic } from "../compiler/types";

/**
 * Compiler diagnostics for the edited file as editor marks, from the reported
 * column to the end of the line. A parse error the compiler noticed only at
 * the next token marks the whole line before instead, where the mistake
 * likely is. Diagnostics without a line, or for another file such as a
 * header, appear only in the diagnostics list.
 */
export function editorDiagnostics(
  doc: Text,
  diagnostics: readonly CompilerDiagnostic[],
  filename: string,
): Diagnostic[] {
  return diagnostics.flatMap((diagnostic) => {
    const marked = likelyLine(diagnostic);
    if (
      marked === undefined ||
      (diagnostic.file !== undefined && diagnostic.file !== filename)
    ) {
      return [];
    }
    const line = doc.line(Math.min(Math.max(marked, 1), doc.lines));
    const column = marked === diagnostic.line ? (diagnostic.column ?? 1) : 1;
    const from = Math.min(line.from + Math.max(column - 1, 0), line.to);
    const guidance = diagnosticGuidance(diagnostic);
    return [
      {
        from,
        to: line.to,
        severity: diagnostic.severity,
        message:
          guidance === undefined
            ? diagnostic.message
            : `${diagnostic.message}\n${guidance}`,
      },
    ];
  });
}

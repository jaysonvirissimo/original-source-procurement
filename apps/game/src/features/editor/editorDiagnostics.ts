import type { Diagnostic } from "@codemirror/lint";
import type { Text } from "@codemirror/state";
import type { CompilerDiagnostic } from "../compiler/types";

/**
 * Compiler diagnostics for the edited file as editor marks, from the reported
 * column to the end of the line. Diagnostics without a line, or for another
 * file such as a header, appear only in the diagnostics list.
 */
export function editorDiagnostics(
  doc: Text,
  diagnostics: readonly CompilerDiagnostic[],
  filename: string,
): Diagnostic[] {
  return diagnostics.flatMap((diagnostic) => {
    if (
      diagnostic.line === undefined ||
      (diagnostic.file !== undefined && diagnostic.file !== filename)
    ) {
      return [];
    }
    const line = doc.line(Math.min(Math.max(diagnostic.line, 1), doc.lines));
    const from = Math.min(
      line.from + Math.max((diagnostic.column ?? 1) - 1, 0),
      line.to,
    );
    return [
      {
        from,
        to: line.to,
        severity: diagnostic.severity,
        message: diagnostic.message,
      },
    ];
  });
}

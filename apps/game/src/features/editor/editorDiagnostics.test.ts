import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { editorDiagnostics } from "./editorDiagnostics";

const doc = Text.of(["int f(int a)", "{", "    return a + ;", "}"]);

describe("editorDiagnostics", () => {
  it("marks from the reported column to the end of the line", () => {
    const line = doc.line(3);

    expect(
      editorDiagnostics(
        doc,
        [
          {
            severity: "error",
            file: "f.c",
            line: 3,
            column: 16,
            message: "parse error",
          },
        ],
        "f.c",
      ),
    ).toEqual([
      {
        from: line.from + 15,
        to: line.to,
        severity: "error",
        message: "parse error",
      },
    ]);
  });

  it("marks a whole line when there is no column, and clamps out-of-range positions", () => {
    const [whole, past, before] = editorDiagnostics(
      doc,
      [
        { severity: "warning", line: 2, message: "unused" },
        { severity: "error", line: 9, column: 99, message: "past the end" },
        { severity: "error", line: 0, column: 0, message: "before the start" },
      ],
      "f.c",
    );

    expect(whole).toMatchObject({ from: doc.line(2).from, to: doc.line(2).to });
    expect(past).toMatchObject({ from: doc.length, to: doc.length });
    expect(before).toMatchObject({ from: 0, to: doc.line(1).to });
  });

  it("marks the whole line before a parse error noticed at the next token, with guidance", () => {
    const [marked] = editorDiagnostics(
      doc,
      [
        {
          severity: "error",
          file: "f.c",
          line: 4,
          column: 1,
          message: "parse error before `}'",
        },
      ],
      "f.c",
    );

    expect(marked).toEqual({
      from: doc.line(3).from,
      to: doc.line(3).to,
      severity: "error",
      message:
        "parse error before `}'\nThe compiler did not expect } on line 4. Check the statement before it, on line 3 or earlier; a missing semicolon is a common cause.",
    });
  });

  it("leaves out diagnostics without a line or for another file", () => {
    expect(
      editorDiagnostics(
        doc,
        [
          { severity: "error", message: "no line" },
          { severity: "error", file: "osp.h", line: 1, message: "header" },
        ],
        "f.c",
      ),
    ).toEqual([]);
  });
});

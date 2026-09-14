import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { cpp } from "@codemirror/lang-cpp";
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { lintGutter, setDiagnostics } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef, useState, type ReactElement } from "react";
import type { CompilerDiagnostic } from "../compiler/types";
import styles from "./CEditor.module.css";
import { editorDiagnostics } from "./editorDiagnostics";

const highlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword], color: "var(--osp-info)" },
  {
    tag: [tags.typeName, tags.standard(tags.typeName)],
    color: "var(--osp-grid)",
  },
  {
    tag: [tags.number, tags.string, tags.character],
    color: "var(--osp-warning)",
  },
  { tag: [tags.comment, tags.meta], color: "var(--osp-text-faint)" },
  { tag: [tags.operator, tags.punctuation], color: "var(--osp-text-dim)" },
]);

const theme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "var(--osp-surface-1)",
      color: "var(--osp-text)",
      fontSize: "var(--osp-font-size-code)",
    },
    "&.cm-focused": {
      outline: "var(--osp-border-strong) solid var(--osp-focus)",
    },
    ".cm-scroller": { fontFamily: "var(--osp-font-code)" },
    ".cm-content": { caretColor: "var(--osp-focus)" },
    ".cm-cursor": { borderLeftColor: "var(--osp-focus)" },
    ".cm-gutters": {
      backgroundColor: "var(--osp-surface-0)",
      color: "var(--osp-text-faint)",
      border: "none",
    },
    ".cm-activeLine, .cm-activeLineGutter": {
      backgroundColor: "var(--osp-surface-2)",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "var(--osp-grid-dim)",
    },
    ".cm-matchingBracket": {
      backgroundColor: "transparent",
      outline: "var(--osp-border) solid var(--osp-line)",
    },
    ".cm-lintRange-error": {
      backgroundImage: "none",
      textDecoration: "underline wavy var(--osp-error)",
    },
    ".cm-lintRange-warning": {
      backgroundImage: "none",
      textDecoration: "underline wavy var(--osp-warning)",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--osp-surface-2)",
      color: "var(--osp-text)",
      border: "var(--osp-border) solid var(--osp-line)",
    },
    ".cm-panels": {
      backgroundColor: "var(--osp-surface-0)",
      color: "var(--osp-text)",
    },
  },
  { dark: true },
);

interface CEditorProps {
  /** The source when the editor mounts; later edits live in the editor. */
  readonly initialSource: string;
  readonly label: string;
  readonly filename: string;
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly onChange: (source: string) => void;
  readonly onCompile: () => void;
}

/**
 * The C editor. Mod-Enter compiles. Tab is left to focus navigation, so the
 * keyboard can always leave the editor.
 */
export function CEditor({
  initialSource,
  label,
  filename,
  diagnostics,
  onChange,
  onCompile,
}: CEditorProps): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | undefined>(undefined);
  const handlers = useRef({ onChange, onCompile });
  const [doc] = useState(initialSource);

  useEffect(() => {
    handlers.current = { onChange, onCompile };
  });

  useEffect(() => {
    const parent = host.current;
    /* v8 ignore next 3 -- React attaches the ref before effects run. */
    if (parent === null) {
      return;
    }
    const editor = new EditorView({
      parent,
      state: EditorState.create({
        doc,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          cpp(),
          syntaxHighlighting(highlightStyle),
          lintGutter(),
          keymap.of([
            {
              key: "Mod-Enter",
              run: () => {
                handlers.current.onCompile();
                return true;
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              handlers.current.onChange(update.state.doc.toString());
            }
          }),
          EditorView.contentAttributes.of({ "aria-label": label }),
          theme,
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = undefined;
    };
  }, [doc, label]);

  useEffect(() => {
    const editor = view.current;
    /* v8 ignore next 3 -- the editor effect above runs first. */
    if (editor === undefined) {
      return;
    }
    editor.dispatch(
      setDiagnostics(
        editor.state,
        editorDiagnostics(editor.state.doc, diagnostics, filename),
      ),
    );
  }, [diagnostics, filename]);

  return <div className={styles.editor} ref={host} />;
}

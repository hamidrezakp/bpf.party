import { useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { EditorView, keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { indentUnit, syntaxTree } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { vim } from "@replit/codemirror-vim";

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  onRun: () => void;
  canRun: boolean;
  onSelectStruct: (name: string) => void;
  vimMode: boolean;
}

export default function CodeEditor({
  code,
  onChange,
  onRun,
  canRun,
  onSelectStruct,
  vimMode,
}: CodeEditorProps) {
  const callbacks = useRef({ onRun, canRun, onSelectStruct });
  callbacks.current = { onRun, canRun, onSelectStruct };

  // Keep extensions stable while typing or receiving execution events.
  const extensions = useMemo(
    () => [
      ...(vimMode ? [vim()] : []),
      cpp(),
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              if (callbacks.current.canRun) callbacks.current.onRun();
              return true;
            },
          },
        ]),
      ),
      EditorView.domEventHandlers({
        mousedown: (event, view) => {
          if (!event.ctrlKey && !event.metaKey) return false;
          const position = view.posAtCoords({
            x: event.clientX,
            y: event.clientY,
          });
          if (position === null) return false;
          const node = syntaxTree(view.state).resolveInner(position, 1);
          if (node.type.name !== "TypeIdentifier") return false;
          callbacks.current.onSelectStruct(
            view.state.doc.sliceString(node.from, node.to),
          );
          event.preventDefault();
          return true;
        },
      }),
      EditorView.contentAttributes.of({
        "aria-label": "ویرایشگر کد C",
        dir: "ltr",
        lang: "en",
      }),
      indentUnit.of("    "),
      EditorView.lineWrapping,
      oneDark,
    ],
    [vimMode],
  );

  return (
    <div dir="ltr" style={{ height: "100%" }}>
      <CodeMirror
        value={code}
        height="100%"
        extensions={extensions}
        onChange={onChange}
        placeholder="کد C خود را اینجا بنویسید…"
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightSpecialChars: true,
          foldGutter: false,
          drawSelection: true,
          dropCursor: false,
          allowMultipleSelections: false,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: false,
          autocompletion: false,
          rectangularSelection: false,
          crosshairCursor: false,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: false,
          searchKeymap: true,
          foldKeymap: false,
          completionKeymap: false,
          lintKeymap: false,
        }}
      />
    </div>
  );
}

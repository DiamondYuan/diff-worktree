import { useEffect, useRef, useState } from "react";
import { DiffEditor } from "@monaco-editor/react";

import type { DiffFilePayload } from "../types";
import { normalizeMonacoLanguage } from "./monacoLanguage";

interface DiffViewerPaneProps {
  diffFile: DiffFilePayload | null;
  draftContent: string;
  loading: boolean;
  onDraftChange: (next: string) => void;
  selectedBranch?: string;
}

interface LineChange {
  originalStartLineNumber: number;
  originalEndLineNumber: number;
  modifiedStartLineNumber: number;
  modifiedEndLineNumber: number;
}

function EmptyState({ message }: { message: string }) {
  return <div className="empty-state empty-state-centered">{message}</div>;
}

function applyLineChangeToDraft(originalText: string, draftText: string, lineChange: LineChange) {
  const originalLines = originalText.split("\n");
  const draftLines = draftText.split("\n");
  const originalStart = Math.max(lineChange.originalStartLineNumber - 1, 0);
  const originalEnd = Math.max(lineChange.originalEndLineNumber, originalStart);
  const modifiedStart = Math.max(lineChange.modifiedStartLineNumber - 1, 0);
  const modifiedEnd = Math.max(lineChange.modifiedEndLineNumber, modifiedStart);
  const replacement = originalLines.slice(originalStart, originalEnd);

  return [...draftLines.slice(0, modifiedStart), ...replacement, ...draftLines.slice(modifiedEnd)].join("\n");
}

export function DiffViewerPane({ diffFile, draftContent, loading, onDraftChange, selectedBranch }: DiffViewerPaneProps) {
  const editorLanguage = normalizeMonacoLanguage(diffFile?.language);
  const disposeRef = useRef<{ dispose: () => void } | null>(null);
  const editorRef = useRef<{
    getLineChanges: () => LineChange[] | null;
    getModifiedEditor: () => {
      getValue: () => string;
      onDidChangeModelContent: (listener: () => void) => { dispose: () => void };
    };
  } | null>(null);
  const [lineChanges, setLineChanges] = useState<LineChange[]>([]);
  const isReadOnly = diffFile?.changeType === "deleted";
  const canAcceptChunks = diffFile?.changeType === "modified" || diffFile?.changeType === "renamed";

  function syncLineChanges() {
    setLineChanges(editorRef.current?.getLineChanges() ?? []);
  }

  useEffect(() => {
    return () => {
      disposeRef.current?.dispose();
      disposeRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!canAcceptChunks || !diffFile) {
      setLineChanges([]);
      return;
    }

    syncLineChanges();
  }, [canAcceptChunks, diffFile, draftContent]);

  return (
    <section className="pane pane-wide">
      <header className="pane-header">
        <span>{selectedBranch ?? "Compare branch"}</span>
        <span>Local</span>
      </header>
      <div className="pane-body pane-body-diff">
        {loading ? <EmptyState message="Loading diff..." /> : null}
        {!loading && !diffFile ? <EmptyState message="Select a file to inspect the diff." /> : null}
        {!loading && diffFile?.isBinary ? <EmptyState message="Binary files are not previewed in V1." /> : null}
        {!loading && diffFile?.tooLarge ? <EmptyState message="This file is too large to render." /> : null}
        {!loading && diffFile && !diffFile.isBinary && !diffFile.tooLarge ? (
          <>
            <div className="diff-meta">
              <div className="diff-path">{diffFile.path}</div>
              <div className={`pill pill-${diffFile.changeType}`}>{diffFile.changeType}</div>
            </div>
            <div className="diff-editor-shell" data-testid="diff-editor-shell">
              {canAcceptChunks && lineChanges.length > 0 ? (
                <div className="diff-apply-actions">
                  {lineChanges.map((lineChange, index) => (
                    <button
                      key={`${lineChange.originalStartLineNumber}-${lineChange.modifiedStartLineNumber}-${index}`}
                      onClick={() => {
                        onDraftChange(applyLineChangeToDraft(diffFile.left, draftContent, lineChange));
                      }}
                      type="button"
                    >
                      接受
                    </button>
                  ))}
                </div>
              ) : null}
              <DiffEditor
                height="100%"
                language={editorLanguage}
                modified={draftContent}
                options={{
                  automaticLayout: true,
                  fontSize: 13,
                  minimap: { enabled: false },
                  readOnly: isReadOnly,
                }}
                onMount={(editor) => {
                  editorRef.current = editor;
                  disposeRef.current?.dispose();
                  disposeRef.current = editor.getModifiedEditor().onDidChangeModelContent(() => {
                    if (isReadOnly) {
                      return;
                    }

                    syncLineChanges();
                    onDraftChange(editor.getModifiedEditor().getValue());
                  });
                  syncLineChanges();
                }}
                original={diffFile.left}
                theme="vs"
              />
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

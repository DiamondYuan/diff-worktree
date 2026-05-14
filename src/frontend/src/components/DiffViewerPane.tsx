import { useEffect, useRef } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { FileX2, LoaderCircle, PackageX } from "lucide-react";

import type { DiffFilePayload } from "../types";
import { normalizeMonacoLanguage } from "./monacoLanguage";

interface DiffViewerPaneProps {
  diffFile: DiffFilePayload | null;
  draftContent: string;
  loading: boolean;
  onDraftChange: (next: string) => void;
  selectedBranch?: string;
}

function EmptyState({
  icon,
  title,
  message,
  tone = "default",
}: {
  icon?: React.ReactNode;
  title: string;
  message: string;
  tone?: "default" | "gentle";
}) {
  return (
    <div className="empty-state-shell empty-state-shell-centered">
      <div className={`empty-state-card${tone === "gentle" ? " empty-state-card-gentle" : ""}`}>
        {icon ? (
          <div className="empty-state-badge" aria-hidden="true">
            {icon}
          </div>
        ) : null}
        <h3 className="empty-state-title">{title}</h3>
        <p className="empty-state-description">{message}</p>
      </div>
    </div>
  );
}

export function DiffViewerPane({ diffFile, draftContent, loading, onDraftChange, selectedBranch }: DiffViewerPaneProps) {
  const editorLanguage = normalizeMonacoLanguage(diffFile?.language);
  const disposeRef = useRef<{ dispose: () => void } | null>(null);
  const isReadOnly = diffFile?.changeType === "deleted";

  useEffect(() => {
    return () => {
      disposeRef.current?.dispose();
      disposeRef.current = null;
    };
  }, []);

  return (
    <section className="pane pane-wide">
      <header className="pane-header">
        <span>{selectedBranch ?? "Compare branch"}</span>
        <span>Local</span>
      </header>
      <div className="pane-body pane-body-diff">
        {loading ? (
          <EmptyState
            icon={<LoaderCircle size={16} />}
            message="Loading the selected file diff and editor state."
            title="Building diff preview"
          />
        ) : null}
        {!loading && !diffFile ? (
          <EmptyState
            message="Select any changed file from the left panel and the side-by-side diff will appear here."
            title="Diff preview is waiting for a selection"
            tone="gentle"
          />
        ) : null}
        {!loading && diffFile?.isBinary ? (
          <EmptyState
            icon={<PackageX size={16} />}
            message="Binary files are detected correctly, but inline preview is not supported in this version."
            title="Binary diff cannot be rendered"
          />
        ) : null}
        {!loading && diffFile?.tooLarge ? (
          <EmptyState
            icon={<FileX2 size={16} />}
            message="This file exceeds the current rendering limit, so the editor preview has been intentionally disabled."
            title="File is too large to display"
          />
        ) : null}
        {!loading && diffFile && !diffFile.isBinary && !diffFile.tooLarge ? (
          <>
            <div className="diff-meta">
              <div className="diff-path">{diffFile.path}</div>
              <div className={`pill pill-${diffFile.changeType}`}>{diffFile.changeType}</div>
            </div>
            <div className="diff-editor-shell" data-testid="diff-editor-shell">
              <DiffEditor
                beforeMount={(monaco) => {
                  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                    noSemanticValidation: true,
                    noSyntaxValidation: true,
                  });
                  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                    noSemanticValidation: true,
                    noSyntaxValidation: true,
                  });
                }}
                height="100%"
                language={editorLanguage}
                modified={draftContent}
                options={{
                  automaticLayout: true,
                  fontSize: 13,
                  minimap: { enabled: false },
                  readOnly: isReadOnly,
                  hideUnchangedRegions: {
                    enabled: true,
                    contextLineCount: 3,
                    minimumLineCount: 3,
                    revealLineCount: 20,
                  },
                  scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
                }}
                onMount={(editor) => {
                  disposeRef.current?.dispose();
                  disposeRef.current = editor.getModifiedEditor().onDidChangeModelContent(() => {
                    if (isReadOnly) {
                      return;
                    }

                    onDraftChange(editor.getModifiedEditor().getValue());
                  });
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

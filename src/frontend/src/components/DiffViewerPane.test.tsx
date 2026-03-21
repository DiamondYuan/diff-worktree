// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DiffViewerPane } from "./DiffViewerPane";

const diffEditorSpy = vi.fn();
const disposeSpy = vi.fn();

const fakeModifiedEditor = {
  getValue: vi.fn(() => ""),
  onDidChangeModelContent: vi.fn(() => ({
    dispose: disposeSpy,
  })),
};

const fakeDiffEditor = {
  getModifiedEditor: vi.fn(() => fakeModifiedEditor),
};

vi.mock("@monaco-editor/react", () => ({
  DiffEditor: (props: { language?: string; theme?: string; onMount?: (editor: typeof fakeDiffEditor) => void }) => {
    diffEditorSpy(props);
    queueMicrotask(() => {
      props.onMount?.(fakeDiffEditor);
    });
    return <div>mock diff editor</div>;
  },
}));

describe("DiffViewerPane", () => {
  const modifiedFile = {
    path: "src/example.ts",
    changeType: "modified" as const,
    language: "ts",
    left: "before",
    right: "after",
    isBinary: false,
    tooLarge: false,
  };

  const deletedFile = {
    path: "src/deleted.ts",
    changeType: "deleted" as const,
    language: "ts",
    left: "before",
    right: "",
    isBinary: false,
    tooLarge: false,
  };

  afterEach(() => {
    cleanup();
    diffEditorSpy.mockClear();
    disposeSpy.mockClear();
    fakeModifiedEditor.onDidChangeModelContent.mockClear();
  });

  it("normalizes Monaco language ids and uses the light editor theme", () => {
    render(
      <DiffViewerPane
        diffFile={modifiedFile}
        draftContent="draft after"
        loading={false}
        onDraftChange={vi.fn()}
        selectedBranch="main"
      />,
    );

    expect(diffEditorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "typescript",
        modified: "draft after",
        options: expect.objectContaining({
          readOnly: false,
        }),
        theme: "vs",
      }),
    );
  });

  it("renders a dedicated stretch container for the diff editor", () => {
    render(
      <DiffViewerPane
        diffFile={modifiedFile}
        draftContent="draft after"
        loading={false}
        onDraftChange={vi.fn()}
        selectedBranch="main"
      />,
    );

    expect(screen.getByTestId("diff-editor-shell")).toBeInTheDocument();
  });

  it("renders a side label header for the selected branch and local workspace", () => {
    render(
      <DiffViewerPane
        diffFile={modifiedFile}
        draftContent="draft after"
        loading={false}
        onDraftChange={vi.fn()}
        selectedBranch="main"
      />,
    );

    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("Local")).toBeInTheDocument();
  });

  it("renders the richer empty state when no file is selected", () => {
    render(
      <DiffViewerPane
        diffFile={null}
        draftContent=""
        loading={false}
        onDraftChange={vi.fn()}
        selectedBranch="main"
      />,
    );

    expect(screen.getByText("Diff preview is waiting for a selection")).toBeInTheDocument();
    expect(
      screen.getByText("Select any changed file from the left panel and the side-by-side diff will appear here."),
    ).toBeInTheDocument();
  });

  it("keeps deleted files read-only on the local side", () => {
    render(
      <DiffViewerPane
        diffFile={deletedFile}
        draftContent=""
        loading={false}
        onDraftChange={vi.fn()}
        selectedBranch="main"
      />,
    );

    expect(diffEditorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        modified: "",
        options: expect.objectContaining({
          readOnly: true,
        }),
      }),
    );
  });
});

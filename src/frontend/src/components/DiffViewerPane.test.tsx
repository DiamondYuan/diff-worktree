// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DiffViewerPane } from "./DiffViewerPane";

const diffEditorSpy = vi.fn();
const disposeSpy = vi.fn();
let mockLineChanges: Array<{
  originalStartLineNumber: number;
  originalEndLineNumber: number;
  modifiedStartLineNumber: number;
  modifiedEndLineNumber: number;
}> = [];

const fakeModifiedEditor = {
  getValue: vi.fn(() => ""),
  onDidChangeModelContent: vi.fn(() => ({
    dispose: disposeSpy,
  })),
};

const fakeDiffEditor = {
  getLineChanges: vi.fn(() => mockLineChanges),
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
    fakeDiffEditor.getLineChanges.mockClear();
    fakeModifiedEditor.onDidChangeModelContent.mockClear();
    mockLineChanges = [];
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

    expect(screen.getByText("Pick a file to start reviewing")).toBeInTheDocument();
    expect(
      screen.getByText("Choose a file from the change tree to inspect its remote and local versions side by side."),
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

  it("accepts a remote hunk into the current local draft", async () => {
    mockLineChanges = [
      {
        originalStartLineNumber: 2,
        originalEndLineNumber: 2,
        modifiedStartLineNumber: 2,
        modifiedEndLineNumber: 2,
      },
    ];
    const onDraftChange = vi.fn();

    render(
      <DiffViewerPane
        diffFile={{
          path: "src/example.ts",
          changeType: "modified",
          language: "ts",
          left: "one\nremote\nthree\n",
          right: "one\nlocal\nthree\n",
          isBinary: false,
          tooLarge: false,
        }}
        draftContent={"one\nlocal\nthree\n"}
        loading={false}
        onDraftChange={onDraftChange}
        selectedBranch="main"
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "接受" }));

    expect(onDraftChange).toHaveBeenLastCalledWith("one\nremote\nthree\n");
  });

  it("recomputes accept ranges from the latest draft instead of caching stale coordinates", async () => {
    const onDraftChange = vi.fn();
    mockLineChanges = [
      {
        originalStartLineNumber: 2,
        originalEndLineNumber: 2,
        modifiedStartLineNumber: 2,
        modifiedEndLineNumber: 2,
      },
    ];

    const { rerender } = render(
      <DiffViewerPane
        diffFile={{
          path: "src/example.ts",
          changeType: "modified",
          language: "ts",
          left: "one\nremote replacement\nthree\n",
          right: "one\nlocal\nthree\n",
          isBinary: false,
          tooLarge: false,
        }}
        draftContent={"one\nlocal\nthree\n"}
        loading={false}
        onDraftChange={onDraftChange}
        selectedBranch="main"
      />,
    );

    mockLineChanges = [
      {
        originalStartLineNumber: 2,
        originalEndLineNumber: 2,
        modifiedStartLineNumber: 2,
        modifiedEndLineNumber: 2,
      },
    ];

    rerender(
      <DiffViewerPane
        diffFile={{
          path: "src/example.ts",
          changeType: "modified",
          language: "ts",
          left: "one\nremote replacement\nthree\n",
          right: "one\nlocal edited\nthree\n",
          isBinary: false,
          tooLarge: false,
        }}
        draftContent={"one\nlocal edited\nthree\n"}
        loading={false}
        onDraftChange={onDraftChange}
        selectedBranch="main"
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "接受" }));

    expect(onDraftChange).toHaveBeenLastCalledWith("one\nremote replacement\nthree\n");
  });
});

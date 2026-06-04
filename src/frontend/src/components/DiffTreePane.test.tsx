// @vitest-environment jsdom

import { useState } from "react";
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DiffTreePane } from "./DiffTreePane";

describe("DiffTreePane", () => {
  afterEach(() => {
    cleanup();
  });

  function TreeHarness() {
    const [selectedPath, setSelectedPath] = useState("src/nested/deleted.ts");
    const [selectedFilePath, setSelectedFilePath] = useState("src/nested/deleted.ts");

    return (
      <DiffTreePane
        loading={false}
        nodes={[
          {
            path: "src",
            name: "src",
            type: "directory",
            children: [
              {
                path: "src/nested",
                name: "nested",
                type: "directory",
                children: [
                  {
                    path: "src/nested/deleted.ts",
                    name: "deleted.ts",
                    type: "file",
                    changeType: "deleted",
                  },
                ],
              },
            ],
          },
        ]}
        onSelectFile={(path) => {
          setSelectedPath(path);
          setSelectedFilePath(path);
        }}
        selectedBranch="main"
        selectedFilePath={selectedFilePath}
        {...({
          selectedPath,
          onSelectItem: (node: { path: string; type: string }) => {
            setSelectedPath(node.path);
            if (node.type === "file") {
              setSelectedFilePath(node.path);
            }
          },
        } as Record<string, unknown>)}
      />
    );
  }

  it("renders nested explorer rows with a shared left-aligned name column", () => {
    const onSelectFile = vi.fn();
    const { container } = render(
      <DiffTreePane
        loading={false}
        nodes={[
          {
            path: "src",
            name: "src",
            type: "directory",
            children: [
              {
                path: "src/nested",
                name: "nested",
                type: "directory",
                children: [
                  {
                    path: "src/nested/deleted.ts",
                    name: "deleted.ts",
                    type: "file",
                    changeType: "deleted",
                  },
                ],
              },
            ],
          },
        ]}
        onSelectFile={onSelectFile}
        selectedBranch="main"
        selectedFilePath="src/nested/deleted.ts"
      />,
    );

    const directoryRow = screen.getByRole("button", { name: "src" });
    const fileButton = screen.getByRole("button", { name: "deleted.ts" });
    const fileRow = fileButton.closest(".tree-row");

    expect(directoryRow?.querySelector(".tree-entry-main")).toBeInTheDocument();
    expect(fileRow).toHaveAttribute("data-depth", "2");
    expect(fileButton.querySelector(".tree-entry-main")).toBeInTheDocument();
    expect(fileButton.querySelector(".tree-file-icon")).toBeInTheDocument();
    expect(within(fileRow as HTMLElement).getByText("D")).toHaveClass("tree-file-status");

    expect(container.querySelector(".tree-folder-icon")).not.toBeInTheDocument();
    expect(container.querySelector(".tree-directory-status")).not.toBeInTheDocument();
  });

  it("does not reserve an empty file icon slot for directory rows", () => {
    render(
      <DiffTreePane
        loading={false}
        nodes={[
          {
            path: "src",
            name: "src",
            type: "directory",
            children: [],
          },
        ]}
        onSelectFile={vi.fn()}
        selectedBranch="main"
      />,
    );

    const directoryButton = screen.getByRole("button", { name: "src" });

    expect(directoryButton.querySelector(".tree-entry-icon")).not.toBeInTheDocument();
  });

  it("moves selection between visible rows with arrow keys", () => {
    render(<TreeHarness />);

    const fileButton = screen.getByRole("button", { name: "deleted.ts" });
    fileButton.focus();
    fireEvent.keyDown(fileButton, { key: "ArrowUp" });

    expect(screen.getByRole("button", { name: "nested" })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("button", { name: "nested" }), { key: "ArrowUp" });

    expect(screen.getByRole("button", { name: "src" })).toHaveFocus();
  });

  it("toggles a review checkbox and reports the new state with the review progress", () => {
    const onToggleReview = vi.fn();
    render(
      <DiffTreePane
        loading={false}
        nodes={[
          { path: "a.ts", name: "a.ts", type: "file", changeType: "modified", reviewHash: "hash-a", reviewed: false },
          { path: "b.ts", name: "b.ts", type: "file", changeType: "modified", reviewHash: "hash-b", reviewed: true },
        ]}
        onSelectFile={vi.fn()}
        onToggleReview={onToggleReview}
        selectedBranch="main"
      />,
    );

    expect(screen.getByText("1/2 reviewed")).toBeInTheDocument();

    const checkbox = screen.getByRole("checkbox", { name: "Mark a.ts as reviewed" });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    expect(onToggleReview).toHaveBeenCalledWith(expect.objectContaining({ path: "a.ts" }), true);
    expect(checkbox).toBeChecked();
    expect(screen.getByText("2/2 reviewed")).toBeInTheDocument();
  });

  it("renders spec and test TypeScript filenames in red when enabled", () => {
    render(
      <DiffTreePane
        highlightTestFiles={true}
        loading={false}
        nodes={[
          { path: "src/a.spec.ts", name: "a.spec.ts", type: "file", changeType: "modified" },
          { path: "src/b.test.ts", name: "b.test.ts", type: "file", changeType: "modified" },
          { path: "src/c.spec.tsx", name: "c.spec.tsx", type: "file", changeType: "modified" },
          { path: "src/d.test.tsx", name: "d.test.tsx", type: "file", changeType: "modified" },
          { path: "src/c.ts", name: "c.ts", type: "file", changeType: "modified" },
        ]}
        onSelectFile={vi.fn()}
        selectedBranch="main"
      />,
    );

    expect(screen.getByText("a.spec.ts")).toHaveClass("tree-file-label-highlight");
    expect(screen.getByText("b.test.ts")).toHaveClass("tree-file-label-highlight");
    expect(screen.getByText("c.spec.tsx")).toHaveClass("tree-file-label-highlight");
    expect(screen.getByText("d.test.tsx")).toHaveClass("tree-file-label-highlight");
    expect(screen.getByText("c.ts")).not.toHaveClass("tree-file-label-highlight");
  });

  it("does not highlight test filenames when disabled", () => {
    render(
      <DiffTreePane
        highlightTestFiles={false}
        loading={false}
        nodes={[{ path: "src/a.spec.ts", name: "a.spec.ts", type: "file", changeType: "modified" }]}
        onSelectFile={vi.fn()}
        selectedBranch="main"
      />,
    );

    expect(screen.getByText("a.spec.ts")).not.toHaveClass("tree-file-label-highlight");
  });

  it("renders the richer synced empty state when there are no changed files", () => {
    render(
      <DiffTreePane
        loading={false}
        nodes={[]}
        onSelectFile={vi.fn()}
        selectedBranch="main"
      />,
    );

    expect(screen.getByText("No file changes to review")).toBeInTheDocument();
    expect(
      screen.getByText("The workspace currently matches main. Switch branches or make edits to inspect a new diff."),
    ).toBeInTheDocument();
  });
});

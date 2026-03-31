// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

const api = vi.hoisted(() => ({
  getRepoSummary: vi.fn(),
  getBranches: vi.fn(),
  getDiffTree: vi.fn(),
  getDiffFile: vi.fn(),
  refreshRepo: vi.fn(),
  saveWorkspaceFile: vi.fn(),
  updateLocalBranch: vi.fn(),
  deleteLocalBranch: vi.fn(),
  deleteRemoteBranch: vi.fn(),
  useRemoteVersion: vi.fn(),
}));

vi.mock("./api/client", () => api);

function makeLocalBranch(name: string, overrides: Record<string, unknown> = {}) {
  return {
    scope: "local" as const,
    name,
    displayName: name,
    isCurrent: name === "main",
    ahead: 0,
    behind: 0,
    syncStatus: "upToDate" as const,
    lastCommitOid: "abc",
    lastCommitMessage: "msg",
    lastCommitAuthorDate: "2026-03-20T00:00:00Z",
    canDelete: name !== "main",
    canUpdate: false,
    ...overrides,
  };
}

function makeRemoteBranch(name: string, overrides: Record<string, unknown> = {}) {
  const slashIndex = name.indexOf("/");
  const shortName = slashIndex === -1 ? name : name.slice(slashIndex + 1);

  return {
    scope: "remote" as const,
    name,
    displayName: shortName,
    remoteName: slashIndex === -1 ? undefined : name.slice(0, slashIndex),
    shortName,
    isCurrent: false,
    ahead: 0,
    behind: 0,
    syncStatus: "upToDate" as const,
    lastCommitOid: "def",
    lastCommitMessage: "msg",
    lastCommitAuthorDate: "2026-03-21T00:00:00Z",
    canDelete: true,
    canUpdate: false,
    ...overrides,
  };
}

function makeBranchLists(localBranches = [makeLocalBranch("main")], remoteBranches = [] as ReturnType<typeof makeRemoteBranch>[]) {
  return {
    localBranches,
    remoteBranches,
  };
}

vi.mock("./components/DiffViewerPane", () => ({
  DiffViewerPane: ({
    diffFile,
    draftContent,
    loading,
    onDraftChange,
  }: {
    diffFile: { left: string; changeType: string } | null;
    draftContent: string;
    loading: boolean;
    onDraftChange: (next: string) => void;
  }) => (
    <div>
      <div data-testid="diff-editor">{`${diffFile?.left ?? ""} => ${draftContent}`}</div>
      <input
        data-testid="draft-input-proxy"
        disabled={loading || diffFile?.changeType === "deleted"}
        value={draftContent}
        onChange={(event) => onDraftChange(event.target.value)}
      />
    </div>
  ),
}));

describe("App", () => {
  beforeEach(() => {
    api.getRepoSummary.mockResolvedValue({
      repoRoot: "/repo",
      homeDir: "/Users/diamondyuan",
      currentBranch: "main",
      defaultSelectedBranch: "main",
      branchPollIntervalMs: 60000,
    });
    api.getBranches.mockResolvedValue(makeBranchLists());
    api.refreshRepo.mockResolvedValue(makeBranchLists());
    api.saveWorkspaceFile.mockResolvedValue({ path: "src/a.ts", saved: true });
    api.updateLocalBranch.mockResolvedValue(makeBranchLists());
    api.deleteLocalBranch.mockResolvedValue(makeBranchLists());
    api.deleteRemoteBranch.mockResolvedValue(makeBranchLists());
    api.useRemoteVersion.mockResolvedValue({ ok: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it("loads the initial diff once branches finish loading for a restored branch selection", async () => {
    const initialBranches = [makeLocalBranch("main")];

    api.getBranches.mockImplementationOnce(() => new Promise(() => undefined));
    api.getBranches.mockResolvedValue(makeBranchLists(initialBranches));
    api.getDiffTree.mockResolvedValue([
      {
        path: "111.md",
        name: "111.md",
        type: "file",
        changeType: "added",
      },
    ]);
    api.getDiffFile.mockResolvedValue({
      path: "111.md",
      changeType: "added",
      language: "md",
      left: "",
      right: "hello\n",
      isBinary: false,
      tooLarge: false,
    });

    window.sessionStorage.setItem("diff-worktree:selected-branch", "main");
    render(<App />);

    await waitFor(() => {
      expect(api.getBranches).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(api.getDiffTree).toHaveBeenCalledWith("main");
    });
    await waitFor(() => {
      expect(screen.getByTestId("diff-editor")).toHaveTextContent("=> hello");
    });
  });

  it("keeps the selected file after a manual refresh when the file still exists", async () => {
    api.getDiffTree
      .mockResolvedValueOnce([
        {
          path: "src",
          name: "src",
          type: "directory",
          children: [
            { path: "src/a.ts", name: "a.ts", type: "file", changeType: "modified" },
            { path: "src/b.ts", name: "b.ts", type: "file", changeType: "renamed", oldPath: "src/old-b.ts" },
          ],
        },
      ])
      .mockResolvedValueOnce([
        {
          path: "src",
          name: "src",
          type: "directory",
          children: [
            { path: "src/a.ts", name: "a.ts", type: "file", changeType: "modified" },
            { path: "src/b.ts", name: "b.ts", type: "file", changeType: "renamed", oldPath: "src/old-b.ts" },
          ],
        },
      ]);
    api.getDiffFile
      .mockResolvedValueOnce({
        path: "src/a.ts",
        changeType: "modified",
        language: "ts",
        left: "old a",
        right: "new a",
        isBinary: false,
        tooLarge: false,
      })
      .mockResolvedValueOnce({
        path: "src/b.ts",
        changeType: "renamed",
        oldPath: "src/old-b.ts",
        language: "ts",
        left: "old b",
        right: "new b",
        isBinary: false,
        tooLarge: false,
      })
      .mockResolvedValueOnce({
        path: "src/b.ts",
        changeType: "renamed",
        oldPath: "src/old-b.ts",
        language: "ts",
        left: "old b refresh",
        right: "new b refresh",
        isBinary: false,
        tooLarge: false,
      });

    render(<App />);

    await screen.findByText("renamed from src/old-b.ts");
    await userEvent.click(screen.getByRole("button", { name: "b.ts (renamed from src/old-b.ts)" }));
    await screen.findByText("old b => new b");

    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(api.refreshRepo).toHaveBeenCalledTimes(1);
      expect(api.getDiffFile).toHaveBeenLastCalledWith("main", "src/b.ts");
    });
    await screen.findByText("old b refresh => new b refresh");
  });

  it("falls back to the first available file after refresh when the selection disappears", async () => {
    api.getDiffTree
      .mockResolvedValueOnce([
        {
          path: "src",
          name: "src",
          type: "directory",
          children: [
            { path: "src/a.ts", name: "a.ts", type: "file", changeType: "modified" },
            { path: "src/b.ts", name: "b.ts", type: "file", changeType: "modified" },
          ],
        },
      ])
      .mockResolvedValueOnce([
        {
          path: "src",
          name: "src",
          type: "directory",
          children: [{ path: "src/a.ts", name: "a.ts", type: "file", changeType: "modified" }],
        },
      ]);
    api.getDiffFile
      .mockResolvedValueOnce({
        path: "src/a.ts",
        changeType: "modified",
        language: "ts",
        left: "old a",
        right: "new a",
        isBinary: false,
        tooLarge: false,
      })
      .mockResolvedValueOnce({
        path: "src/b.ts",
        changeType: "modified",
        language: "ts",
        left: "old b",
        right: "new b",
        isBinary: false,
        tooLarge: false,
      })
      .mockResolvedValueOnce({
        path: "src/a.ts",
        changeType: "modified",
        language: "ts",
        left: "old a refresh",
        right: "new a refresh",
        isBinary: false,
        tooLarge: false,
      });

    render(<App />);

    await screen.findByRole("button", { name: "b.ts" });
    await userEvent.click(screen.getByRole("button", { name: "b.ts" }));
    await screen.findByText("old b => new b");

    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(api.getDiffFile).toHaveBeenLastCalledWith("main", "src/a.ts");
    });
    await screen.findByText("old a refresh => new a refresh");
  });

  it("keeps the current diff visible when selecting a directory", async () => {
    api.getDiffTree.mockResolvedValue([
      {
        path: "src",
        name: "src",
        type: "directory",
        children: [{ path: "src/a.ts", name: "a.ts", type: "file", changeType: "modified" }],
      },
    ]);
    api.getDiffFile.mockResolvedValue({
      path: "src/a.ts",
      changeType: "modified",
      language: "ts",
      left: "old a",
      right: "new a",
      isBinary: false,
      tooLarge: false,
    });

    render(<App />);

    await screen.findByText("old a => new a");
    await userEvent.click(screen.getByRole("button", { name: "src" }));

    expect(api.getDiffFile).toHaveBeenCalledTimes(1);
    expect(screen.getByText("old a => new a")).toBeInTheDocument();
  });

  it("renders the updated pane headers", async () => {
    api.getDiffTree.mockResolvedValue([
      {
        path: "src",
        name: "src",
        type: "directory",
        children: [{ path: "src/a.ts", name: "a.ts", type: "file", changeType: "modified" }],
      },
    ]);
    api.getDiffFile.mockResolvedValue({
      path: "src/a.ts",
      changeType: "modified",
      language: "ts",
      left: "old a",
      right: "new a",
      isBinary: false,
      tooLarge: false,
    });

    render(<App />);

    await screen.findByText("old a => new a");

    expect(screen.getByRole("button", { name: /refresh/i })).toHaveClass("ghost-button-plain");
    expect(screen.queryByText("Refresh")).not.toBeInTheDocument();
    expect(screen.queryByText("1 local")).not.toBeInTheDocument();
    expect(screen.queryByText("Diff Tree")).not.toBeInTheDocument();
    expect(screen.queryByText("Diff Viewer")).not.toBeInTheDocument();
    expect(screen.getByText("main vs workspace")).toBeInTheDocument();
  });

  it("autosaves only the latest draft after 500ms of idle time", async () => {
    api.getDiffTree.mockResolvedValue([
      {
        path: "src",
        name: "src",
        type: "directory",
        children: [{ path: "src/a.ts", name: "a.ts", type: "file", changeType: "modified" }],
      },
    ]);
    api.getDiffFile
      .mockResolvedValueOnce({
        path: "src/a.ts",
        changeType: "modified",
        language: "ts",
        left: "old a",
        right: "new a",
        isBinary: false,
        tooLarge: false,
      })
      .mockResolvedValueOnce({
        path: "src/a.ts",
        changeType: "modified",
        language: "ts",
        left: "old a",
        right: "new a!?",
        isBinary: false,
        tooLarge: false,
      });

    render(<App />);

    await screen.findByText("old a => new a");
    const input = await screen.findByTestId("draft-input-proxy");
    vi.useFakeTimers();
    fireEvent.change(input, { target: { value: "new a!?" } });
    expect(api.saveWorkspaceFile).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    vi.useRealTimers();

    await waitFor(() => {
      expect(api.saveWorkspaceFile).toHaveBeenCalledTimes(1);
      expect(api.saveWorkspaceFile).toHaveBeenCalledWith("src/a.ts", "new a!?");
      expect(api.getDiffFile).toHaveBeenLastCalledWith("main", "src/a.ts");
    });
  });

  it("cancels a pending autosave when the user switches files before debounce fires", async () => {
    api.getDiffTree.mockResolvedValue([
      {
        path: "src",
        name: "src",
        type: "directory",
        children: [
          { path: "src/a.ts", name: "a.ts", type: "file", changeType: "modified" },
          { path: "src/b.ts", name: "b.ts", type: "file", changeType: "modified" },
        ],
      },
    ]);
    api.getDiffFile
      .mockResolvedValueOnce({
        path: "src/a.ts",
        changeType: "modified",
        language: "ts",
        left: "old a",
        right: "new a",
        isBinary: false,
        tooLarge: false,
      })
      .mockResolvedValueOnce({
        path: "src/b.ts",
        changeType: "modified",
        language: "ts",
        left: "old b",
        right: "new b",
        isBinary: false,
        tooLarge: false,
      });

    render(<App />);

    await screen.findByRole("button", { name: "b.ts" });
    await screen.findByText("old a => new a");
    const input = await screen.findByTestId("draft-input-proxy");
    vi.useFakeTimers();
    fireEvent.change(input, { target: { value: "new a!" } });
    fireEvent.click(screen.getByRole("button", { name: "b.ts" }));
    await vi.advanceTimersByTimeAsync(500);
    vi.useRealTimers();

    expect(api.saveWorkspaceFile).not.toHaveBeenCalled();
  });

  it("keeps the draft visible and surfaces an error when autosave fails", async () => {
    api.getDiffTree.mockResolvedValue([
      {
        path: "src",
        name: "src",
        type: "directory",
        children: [{ path: "src/a.ts", name: "a.ts", type: "file", changeType: "modified" }],
      },
    ]);
    api.getDiffFile.mockResolvedValue({
      path: "src/a.ts",
      changeType: "modified",
      language: "ts",
      left: "old a",
      right: "new a",
      isBinary: false,
      tooLarge: false,
    });
    api.saveWorkspaceFile.mockRejectedValueOnce(new Error("save failed"));

    render(<App />);

    await screen.findByText("old a => new a");
    const input = await screen.findByTestId("draft-input-proxy");
    vi.useFakeTimers();
    fireEvent.change(input, { target: { value: "new a!" } });
    await vi.advanceTimersByTimeAsync(500);
    vi.useRealTimers();

    await screen.findByText("save failed");
    expect(screen.getByTestId("draft-input-proxy")).toHaveValue("new a!");
  });

  it("restores the selected branch and file from session storage", async () => {
    window.sessionStorage.setItem("diff-worktree:selected-branch", "feature/test");
    window.sessionStorage.setItem("diff-worktree:selected-file", "src/b.ts");

    api.getBranches.mockResolvedValue(
      makeBranchLists([
        makeLocalBranch("main"),
        makeLocalBranch("feature/test", {
          isCurrent: false,
          canDelete: true,
          lastCommitOid: "def",
          lastCommitAuthorDate: "2026-03-21T00:00:00Z",
        }),
      ]),
    );
    api.getDiffTree.mockResolvedValue([
      {
        path: "src",
        name: "src",
        type: "directory",
        children: [
          { path: "src/a.ts", name: "a.ts", type: "file", changeType: "modified" },
          { path: "src/b.ts", name: "b.ts", type: "file", changeType: "modified" },
        ],
      },
    ]);
    api.getDiffFile.mockResolvedValue({
      path: "src/b.ts",
      changeType: "modified",
      language: "ts",
      left: "old b",
      right: "new b",
      isBinary: false,
      tooLarge: false,
    });

    render(<App />);

    await screen.findByText("old b => new b");
    expect(screen.getByRole("button", { name: "test up to date" })).toHaveClass("branch-item-selected");
    await waitFor(() => {
      expect(window.sessionStorage.getItem("diff-worktree:selected-branch")).toBe("feature/test");
      expect(window.sessionStorage.getItem("diff-worktree:selected-file")).toBe("src/b.ts");
    });
  });

  it("falls back to a valid branch and clears a stale file selection from session storage", async () => {
    window.sessionStorage.setItem("diff-worktree:selected-branch", "missing-branch");
    window.sessionStorage.setItem("diff-worktree:selected-file", "src/missing.ts");

    api.getDiffTree.mockResolvedValue([
      {
        path: "src",
        name: "src",
        type: "directory",
        children: [{ path: "src/a.ts", name: "a.ts", type: "file", changeType: "modified" }],
      },
    ]);
    api.getDiffFile.mockResolvedValue({
      path: "src/a.ts",
      changeType: "modified",
      language: "ts",
      left: "old a",
      right: "new a",
      isBinary: false,
      tooLarge: false,
    });

    render(<App />);

    await screen.findByText("old a => new a");
    await waitFor(() => {
      expect(window.sessionStorage.getItem("diff-worktree:selected-branch")).toBe("main");
      expect(window.sessionStorage.getItem("diff-worktree:selected-file")).toBe("src/a.ts");
    });
  });

  it("updates a behind local branch and refreshes branch state", async () => {
    api.getBranches.mockResolvedValue(
      makeBranchLists([
        makeLocalBranch("main", {
          behind: 1,
          syncStatus: "behind",
          canUpdate: true,
          disabledReason: undefined,
        }),
      ]),
    );
    api.updateLocalBranch.mockResolvedValue(makeBranchLists([makeLocalBranch("main")]));
    api.getDiffTree.mockResolvedValue([]);

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Update main" }));

    await waitFor(() => {
      expect(api.updateLocalBranch).toHaveBeenCalledWith("main");
    });
  });

  it("deletes a selected local branch and falls back to the default branch", async () => {
    window.sessionStorage.setItem("diff-worktree:selected-branch", "feature/test");

    api.getBranches.mockResolvedValue(
      makeBranchLists([
        makeLocalBranch("main"),
        makeLocalBranch("feature/test", {
          isCurrent: false,
          canDelete: true,
          lastCommitOid: "def",
          lastCommitAuthorDate: "2026-03-21T00:00:00Z",
        }),
      ]),
    );
    api.deleteLocalBranch.mockResolvedValue(makeBranchLists([makeLocalBranch("main")]));
    api.getDiffTree.mockResolvedValue([]);

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Delete feature/test" }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(api.deleteLocalBranch).toHaveBeenCalledWith("feature/test");
      expect(window.sessionStorage.getItem("diff-worktree:selected-branch")).toBe("main");
    });
  });

  it("deletes a remote branch without making it selectable", async () => {
    api.getBranches.mockResolvedValue(makeBranchLists([makeLocalBranch("main")], [makeRemoteBranch("origin/foo")]));
    api.deleteRemoteBranch.mockResolvedValue(makeBranchLists([makeLocalBranch("main")], []));
    api.getDiffTree.mockResolvedValue([]);

    render(<App />);

    expect(await screen.findByText("Remote branches")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete origin/foo" }));

    await waitFor(() => {
      expect(api.deleteRemoteBranch).toHaveBeenCalledWith("origin", "foo");
      expect(screen.queryByText("foo")).not.toBeInTheDocument();
    });
  });
});

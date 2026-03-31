// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BranchPane } from "./BranchPane";

function makeLocalBranch(name: string, overrides: Record<string, unknown> = {}) {
  return {
    scope: "local" as const,
    name,
    displayName: name,
    isCurrent: false,
    ahead: 0,
    behind: 0,
    syncStatus: "upToDate" as const,
    lastCommitOid: "abc",
    lastCommitMessage: "msg",
    lastCommitAuthorDate: "2026-03-20T00:00:00Z",
    canDelete: true,
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

describe("BranchPane", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders home-based repo roots with a tilde prefix", () => {
    render(
      <BranchPane
        localBranches={[]}
        remoteBranches={[]}
        loading={false}
        refreshing={false}
        repoRoot="/Users/diamondyuan/work/project"
        homeDir="/Users/diamondyuan"
        onDeleteLocalBranch={vi.fn()}
        onDeleteRemoteBranch={vi.fn()}
        onRefresh={vi.fn()}
        onSelectBranch={vi.fn()}
        onUpdateLocalBranch={vi.fn()}
      />,
    );

    expect(screen.getByText("~/work/project")).toBeInTheDocument();
  });

  it("leaves non-home repo roots unchanged", () => {
    render(
      <BranchPane
        localBranches={[]}
        remoteBranches={[]}
        loading={false}
        refreshing={false}
        repoRoot="/tmp/demo"
        homeDir="/Users/diamondyuan"
        onDeleteLocalBranch={vi.fn()}
        onDeleteRemoteBranch={vi.fn()}
        onRefresh={vi.fn()}
        onSelectBranch={vi.fn()}
        onUpdateLocalBranch={vi.fn()}
      />,
    );

    expect(screen.getByText("/tmp/demo")).toBeInTheDocument();
  });

  it("renders separate local and remote sections with branch actions", () => {
    render(
      <BranchPane
        localBranches={[
          makeLocalBranch("main", { isCurrent: true, canDelete: false }),
          makeLocalBranch("feature/current", {
            syncStatus: "upToDate",
            canUpdate: false,
            disabledReason: "Already up to date.",
            lastCommitOid: "ghi",
            lastCommitAuthorDate: "2026-03-22T00:00:00Z",
          }),
          makeLocalBranch("feature/no-upstream", {
            syncStatus: "noUpstream",
            canUpdate: false,
            disabledReason: "Branch has no upstream.",
            lastCommitOid: "jkl",
            lastCommitAuthorDate: "2026-03-23T00:00:00Z",
          }),
          makeLocalBranch("feature/diverged", {
            syncStatus: "diverged",
            ahead: 1,
            behind: 1,
            canUpdate: false,
            disabledReason: "Requires manual rebase or merge.",
          }),
        ]}
        remoteBranches={[
          makeRemoteBranch("origin/main", {
            canDelete: false,
            disabledReason: "Protected remote branch.",
          }),
          makeRemoteBranch("origin/foo"),
        ]}
        loading={false}
        refreshing={false}
        onDeleteLocalBranch={vi.fn()}
        onDeleteRemoteBranch={vi.fn()}
        onRefresh={vi.fn()}
        onSelectBranch={vi.fn()}
        onUpdateLocalBranch={vi.fn()}
        repoRoot="/tmp/demo"
        selectedBranch="main"
      />,
    );

    expect(screen.getByText("Local branches")).toBeInTheDocument();
    expect(screen.getByText("Remote branches")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "main current up to date" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "main current up to date" }).closest(".branch-row")).toHaveClass(
      "branch-row-selected",
    );
    expect(screen.getByRole("button", { name: "Update feature/diverged" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Delete origin/main" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete origin/foo" })).toBeInTheDocument();
    expect(screen.getByText("origin/foo")).toHaveClass("branch-item-subtitle");
    expect(screen.queryByRole("button", { name: "foo up to date" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update main" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update feature/current" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update feature/no-upstream" })).not.toBeInTheDocument();
  });
});

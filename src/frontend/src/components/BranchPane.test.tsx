// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState, type ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BranchPane } from "./BranchPane";

const defaultHighlightFilePatterns = ["*.spec.ts", "*.test.ts"];

function makeLocalBranch(name: string, overrides: Record<string, unknown> = {}) {
  return {
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

function renderBranchPane(overrides: Partial<ComponentProps<typeof BranchPane>> = {}) {
  return render(
    <BranchPane
      defaultHighlightFilePatterns={defaultHighlightFilePatterns}
      highlightFilePatterns={defaultHighlightFilePatterns}
      highlightFilesEnabled={false}
      localBranches={[]}
      loading={false}
      refreshing={false}
      onDeleteLocalBranch={vi.fn()}
      onHighlightFilePatternsChange={vi.fn()}
      onHighlightFilesEnabledChange={vi.fn()}
      onRefresh={vi.fn()}
      onSelectBranch={vi.fn()}
      onUpdateLocalBranch={vi.fn()}
      {...overrides}
    />,
  );
}

describe("BranchPane", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders home-based repo roots with a tilde prefix", () => {
    renderBranchPane({
      repoRoot: "/Users/diamondyuan/work/project",
      homeDir: "/Users/diamondyuan",
    });

    expect(screen.getByText("~/work/project")).toBeInTheDocument();
  });

  it("leaves non-home repo roots unchanged", () => {
    renderBranchPane({
      repoRoot: "/tmp/demo",
      homeDir: "/Users/diamondyuan",
    });

    expect(screen.getByText("/tmp/demo")).toBeInTheDocument();
  });

  it("renders local branches with their actions", () => {
    renderBranchPane({
      localBranches: [
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
        ],
      repoRoot: "/tmp/demo",
      selectedBranch: "main",
    });

    expect(screen.queryByText("Local branches")).not.toBeInTheDocument();
    expect(screen.queryByText("Remote branches")).not.toBeInTheDocument();
    expect(screen.getByText("Target")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "main current up to date" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "main current up to date" }).closest(".branch-row")).toHaveClass(
      "branch-row-selected",
    );
    expect(screen.getByRole("button", { name: "Update feature/diverged" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Update main" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update feature/current" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update feature/no-upstream" })).not.toBeInTheDocument();
  });

  it("renders a footer toggle for highlighting files", () => {
    const onHighlightFilesEnabledChange = vi.fn();

    renderBranchPane({
      highlightFilesEnabled: true,
      onHighlightFilesEnabledChange,
    });

    const toggle = screen.getByRole("checkbox", { name: "高亮文件" });
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);

    expect(onHighlightFilesEnabledChange).toHaveBeenCalledWith(false);
  });

  it("edits highlight patterns and restores defaults from the settings popover", () => {
    const onHighlightFilePatternsChange = vi.fn();

    renderBranchPane({
      highlightFilePatterns: ["*.spec.ts"],
      onHighlightFilePatternsChange,
    });

    fireEvent.click(screen.getByRole("button", { name: "配置高亮规则" }));

    const input = screen.getByRole("textbox", { name: "高亮规则" });
    expect(input).toHaveValue("*.spec.ts");

    fireEvent.change(input, { target: { value: "*.story.tsx, src/**/*.snap" } });

    expect(onHighlightFilePatternsChange).toHaveBeenCalledWith(["*.story.tsx", "src/**/*.snap"]);

    fireEvent.click(screen.getByRole("button", { name: "恢复默认" }));

    expect(onHighlightFilePatternsChange).toHaveBeenCalledWith(defaultHighlightFilePatterns);
  });

  it("keeps a just-typed trailing comma in the input while editing", () => {
    const onHighlightFilePatternsChange = vi.fn();

    const { rerender } = renderBranchPane({
      highlightFilePatterns: ["*.spec.ts"],
      onHighlightFilePatternsChange,
    });

    fireEvent.click(screen.getByRole("button", { name: "配置高亮规则" }));

    const input = screen.getByRole("textbox", { name: "高亮规则" });
    fireEvent.change(input, { target: { value: "*.spec.ts," } });

    // The parent re-renders with the parsed (unchanged) patterns; the trailing
    // comma must survive so the user can type the next pattern.
    rerender(
      <BranchPane
        defaultHighlightFilePatterns={defaultHighlightFilePatterns}
        highlightFilePatterns={["*.spec.ts"]}
        highlightFilesEnabled={false}
        localBranches={[]}
        loading={false}
        refreshing={false}
        onDeleteLocalBranch={vi.fn()}
        onHighlightFilePatternsChange={onHighlightFilePatternsChange}
        onHighlightFilesEnabledChange={vi.fn()}
        onRefresh={vi.fn()}
        onSelectBranch={vi.fn()}
        onUpdateLocalBranch={vi.fn()}
      />,
    );

    expect(input).toHaveValue("*.spec.ts,");
  });

  it("reformats the input to canonical text on blur", () => {
    function Harness() {
      const [patterns, setPatterns] = useState<string[]>(["*.spec.ts"]);
      return (
        <BranchPane
          defaultHighlightFilePatterns={defaultHighlightFilePatterns}
          highlightFilePatterns={patterns}
          highlightFilesEnabled={false}
          localBranches={[]}
          loading={false}
          refreshing={false}
          onDeleteLocalBranch={vi.fn()}
          onHighlightFilePatternsChange={setPatterns}
          onHighlightFilesEnabledChange={vi.fn()}
          onRefresh={vi.fn()}
          onSelectBranch={vi.fn()}
          onUpdateLocalBranch={vi.fn()}
        />
      );
    }

    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "配置高亮规则" }));

    const input = screen.getByRole("textbox", { name: "高亮规则" });
    fireEvent.change(input, { target: { value: "*.spec.ts,*.test.ts" } });
    fireEvent.blur(input);

    expect(input).toHaveValue("*.spec.ts, *.test.ts");
  });
});

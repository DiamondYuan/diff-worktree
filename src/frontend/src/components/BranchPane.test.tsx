// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BranchPane } from "./BranchPane";

describe("BranchPane", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders home-based repo roots with a tilde prefix", () => {
    render(
      <BranchPane
        branches={[]}
        loading={false}
        refreshing={false}
        repoRoot="/Users/diamondyuan/work/project"
        homeDir="/Users/diamondyuan"
        onRefresh={vi.fn()}
        onSelectBranch={vi.fn()}
      />,
    );

    expect(screen.getByText("~/work/project")).toBeInTheDocument();
  });

  it("leaves non-home repo roots unchanged", () => {
    render(
      <BranchPane
        branches={[]}
        loading={false}
        refreshing={false}
        repoRoot="/tmp/demo"
        homeDir="/Users/diamondyuan"
        onRefresh={vi.fn()}
        onSelectBranch={vi.fn()}
      />,
    );

    expect(screen.getByText("/tmp/demo")).toBeInTheDocument();
  });
});

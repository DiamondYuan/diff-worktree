import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { findRepoRoot } from "../src/server/services/repoLocator";

const createdDirs: string[] = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "diff-worktree-repo-locator-"));
  createdDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop();
    if (dir) {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  }
});

describe("findRepoRoot", () => {
  it("finds the repository root from a nested directory", () => {
    const root = makeTempDir();
    fs.mkdirSync(path.join(root, ".git"));
    const nested = path.join(root, "src", "feature", "deep");
    fs.mkdirSync(nested, { recursive: true });

    expect(findRepoRoot(nested)).toBe(root);
  });

  it("returns null when no repository exists", () => {
    const root = makeTempDir();
    const nested = path.join(root, "src", "feature");
    fs.mkdirSync(nested, { recursive: true });

    expect(findRepoRoot(nested)).toBeNull();
  });

  it("accepts repositories where .git is a file", () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, ".git"), "gitdir: /tmp/fake\n");
    const nested = path.join(root, "packages", "app");
    fs.mkdirSync(nested, { recursive: true });

    expect(findRepoRoot(nested)).toBe(root);
  });
});

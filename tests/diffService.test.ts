import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import { getDiffFile, listDiffTree } from "../src/server/services/diffService";
import type { DiffTreeNode } from "../src/shared/types";

const createdDirs: string[] = [];

function makeTempDir(prefix: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  createdDirs.push(dir);
  return dir;
}

function runGit(cwd: string, args: string[]) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
  }).trim();
}

function createRepo() {
  const repoRoot = makeTempDir("diff-worktree-diff-");
  runGit(repoRoot, ["init", "--initial-branch=main"]);
  runGit(repoRoot, ["config", "user.name", "Test User"]);
  runGit(repoRoot, ["config", "user.email", "test@example.com"]);
  return repoRoot;
}

function commitFile(repoRoot: string, filePath: string, content: string, message: string) {
  const absolutePath = path.join(repoRoot, filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
  runGit(repoRoot, ["add", filePath]);
  runGit(repoRoot, ["commit", "-m", message]);
}

function flattenFiles(nodes: DiffTreeNode[], results: DiffTreeNode[] = []) {
  for (const node of nodes) {
    if (node.type === "file") {
      results.push(node);
      continue;
    }

    flattenFiles(node.children ?? [], results);
  }

  return results;
}

afterEach(() => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop();
    if (dir) {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  }
});

describe("getDiffFile", () => {
  it("returns an added file with an empty left side", async () => {
    const repoRoot = createRepo();
    commitFile(repoRoot, "README.md", "base\n", "chore: base");
    fs.writeFileSync(path.join(repoRoot, "new.ts"), "export const added = true;\n");

    await expect(getDiffFile(repoRoot, "main", "new.ts")).resolves.toMatchObject({
      path: "new.ts",
      changeType: "added",
      left: "",
      right: "export const added = true;\n",
    });
  });

  it("returns a deleted file with an empty right side", async () => {
    const repoRoot = createRepo();
    commitFile(repoRoot, "obsolete.ts", "export const gone = true;\n", "feat: add obsolete");
    fs.unlinkSync(path.join(repoRoot, "obsolete.ts"));

    await expect(getDiffFile(repoRoot, "main", "obsolete.ts")).resolves.toMatchObject({
      path: "obsolete.ts",
      changeType: "deleted",
      left: "export const gone = true;\n",
      right: "",
    });
  });
});

describe("listDiffTree", () => {
  it("emits grouped file changes including renamed entries", async () => {
    const repoRoot = createRepo();
    commitFile(repoRoot, "src/info/InfoItem.tsx", "export const InfoItem = 1;\n", "feat: info");
    commitFile(repoRoot, "src/pages/home.tsx", "export const home = true;\n", "feat: home");
    commitFile(repoRoot, "src/obsolete.ts", "export const oldValue = 1;\n", "feat: obsolete");

    runGit(repoRoot, ["mv", "src/info/InfoItem.tsx", "src/info/InfoItem1.tsx"]);
    fs.writeFileSync(path.join(repoRoot, "src/pages/home.tsx"), "export const home = false;\n");
    fs.unlinkSync(path.join(repoRoot, "src/obsolete.ts"));
    fs.writeFileSync(path.join(repoRoot, "src/new.ts"), "export const fresh = true;\n");

    const tree = await listDiffTree(repoRoot, "main");
    const files = flattenFiles(tree);

    expect(tree.map((node) => node.name)).toContain("src");
    expect(files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "src/info/InfoItem1.tsx",
          changeType: "renamed",
          oldPath: "src/info/InfoItem.tsx",
        }),
        expect.objectContaining({
          path: "src/pages/home.tsx",
          changeType: "modified",
        }),
        expect.objectContaining({
          path: "src/obsolete.ts",
          changeType: "deleted",
        }),
        expect.objectContaining({
          path: "src/new.ts",
          changeType: "added",
        }),
      ]),
    );
  });
});

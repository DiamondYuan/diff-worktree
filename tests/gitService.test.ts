import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import {
  deleteLocalBranch,
  deleteRemoteBranch,
  getRepoSummary,
  listBranches,
  updateLocalBranch,
  useRemoteVersion,
} from "../src/server/services/gitService";

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

function configureUser(repoRoot: string) {
  runGit(repoRoot, ["config", "user.name", "Test User"]);
  runGit(repoRoot, ["config", "user.email", "test@example.com"]);
}

function commitFile(repoRoot: string, filePath: string, content: string, message: string) {
  fs.writeFileSync(path.join(repoRoot, filePath), content);
  runGit(repoRoot, ["add", filePath]);
  runGit(repoRoot, ["commit", "-m", message]);
}

function cloneRemote(remoteRoot: string, targetRoot: string) {
  execFileSync("git", ["clone", remoteRoot, targetRoot], {
    encoding: "utf8",
  });
  configureUser(targetRoot);
}

function createTrackedRepo() {
  const remoteRoot = makeTempDir("diff-worktree-remote-");
  runGit(remoteRoot, ["init", "--bare", "--initial-branch=main"]);

  const repoRoot = makeTempDir("diff-worktree-repo-");
  cloneRemote(remoteRoot, repoRoot);
  commitFile(repoRoot, "README.md", "initial\n", "chore: initial commit");
  runGit(repoRoot, ["push", "-u", "origin", "main"]);

  return {
    remoteRoot,
    repoRoot,
  };
}

afterEach(() => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop();
    if (dir) {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  }
});

describe("listLocalBranches", () => {
  it("reports an up-to-date tracked branch", async () => {
    const { repoRoot } = createTrackedRepo();

    const { localBranches, remoteBranches } = await listBranches(repoRoot);
    expect(localBranches).toHaveLength(1);
    expect(localBranches[0]).toMatchObject({
      name: "main",
      scope: "local",
      isCurrent: true,
      ahead: 0,
      behind: 0,
      syncStatus: "upToDate",
      upstreamName: "origin/main",
      canDelete: false,
      canUpdate: false,
    });
    expect(remoteBranches).toHaveLength(1);
    expect(remoteBranches[0]).toMatchObject({
      name: "origin/main",
      scope: "remote",
      displayName: "main",
      canDelete: false,
      disabledReason: "Protected remote branch.",
    });
  });

  it("reports a branch that is ahead of upstream", async () => {
    const { repoRoot } = createTrackedRepo();
    commitFile(repoRoot, "ahead.txt", "ahead\n", "feat: local change");

    const mainBranch = (await listBranches(repoRoot)).localBranches.find((branch) => branch.name === "main");
    expect(mainBranch).toMatchObject({
      ahead: 1,
      behind: 0,
      syncStatus: "ahead",
      canUpdate: false,
    });
  });

  it("reports a branch that is behind upstream", async () => {
    const { remoteRoot, repoRoot } = createTrackedRepo();
    const peerRoot = makeTempDir("diff-worktree-peer-");
    cloneRemote(remoteRoot, peerRoot);
    commitFile(peerRoot, "behind.txt", "behind\n", "feat: remote change");
    runGit(peerRoot, ["push", "origin", "main"]);
    runGit(repoRoot, ["fetch", "origin"]);

    const mainBranch = (await listBranches(repoRoot)).localBranches.find((branch) => branch.name === "main");
    expect(mainBranch).toMatchObject({
      ahead: 0,
      behind: 1,
      syncStatus: "behind",
      canUpdate: true,
    });
  });

  it("reports a diverged tracked branch", async () => {
    const { remoteRoot, repoRoot } = createTrackedRepo();
    const peerRoot = makeTempDir("diff-worktree-peer-");
    cloneRemote(remoteRoot, peerRoot);
    commitFile(repoRoot, "local.txt", "local\n", "feat: local change");
    commitFile(peerRoot, "remote.txt", "remote\n", "feat: remote change");
    runGit(peerRoot, ["push", "origin", "main"]);
    runGit(repoRoot, ["fetch", "origin"]);

    const mainBranch = (await listBranches(repoRoot)).localBranches.find((branch) => branch.name === "main");
    expect(mainBranch).toMatchObject({
      ahead: 1,
      behind: 1,
      syncStatus: "diverged",
      canUpdate: false,
    });
  });

  it("reports a branch with no upstream", async () => {
    const { repoRoot } = createTrackedRepo();
    runGit(repoRoot, ["checkout", "-b", "feature/no-upstream"]);

    const featureBranch = (await listBranches(repoRoot)).localBranches.find(
      (branch) => branch.name === "feature/no-upstream",
    );

    expect(featureBranch).toMatchObject({
      name: "feature/no-upstream",
      scope: "local",
      isCurrent: true,
      ahead: 0,
      behind: 0,
      syncStatus: "noUpstream",
      upstreamName: undefined,
      canUpdate: false,
    });
  });

  it("does not crash when a branch points to a missing remote-tracking ref", async () => {
    const { repoRoot } = createTrackedRepo();
    runGit(repoRoot, ["checkout", "-b", "feature/stale-upstream"]);
    runGit(repoRoot, ["branch", "--set-upstream-to", "origin/main"]);
    runGit(repoRoot, ["config", "branch.feature/stale-upstream.merge", "refs/heads/feature/stale-upstream"]);
    runGit(repoRoot, ["update-ref", "-d", "refs/remotes/origin/feature/stale-upstream"]);

    const featureBranch = (await listBranches(repoRoot)).localBranches.find(
      (branch) => branch.name === "feature/stale-upstream",
    );

    expect(featureBranch).toMatchObject({
      name: "feature/stale-upstream",
      isCurrent: true,
      ahead: 0,
      behind: 0,
      syncStatus: "noUpstream",
      upstreamName: undefined,
    });
  });

  it("excludes symbolic remote refs from the remote branch list", async () => {
    const { repoRoot } = createTrackedRepo();

    const { remoteBranches } = await listBranches(repoRoot);

    expect(remoteBranches.some((branch) => branch.name.endsWith("/HEAD"))).toBe(false);
  });
});

describe("deleteLocalBranch", () => {
  it("deletes a merged local branch safely", async () => {
    const { repoRoot } = createTrackedRepo();
    runGit(repoRoot, ["checkout", "-b", "feature/merged"]);
    runGit(repoRoot, ["checkout", "main"]);

    await expect(deleteLocalBranch(repoRoot, "feature/merged")).resolves.toBeUndefined();
    expect(runGit(repoRoot, ["branch", "--list", "feature/merged"])).toBe("");
  });

  it("rejects deleting the current branch", async () => {
    const { repoRoot } = createTrackedRepo();

    await expect(deleteLocalBranch(repoRoot, "main")).rejects.toThrow(/current branch/i);
  });

  it("surfaces git safety errors for unmerged branches", async () => {
    const { repoRoot } = createTrackedRepo();
    runGit(repoRoot, ["checkout", "-b", "feature/unmerged"]);
    commitFile(repoRoot, "unmerged.txt", "work\n", "feat: unmerged");
    runGit(repoRoot, ["checkout", "main"]);

    await expect(deleteLocalBranch(repoRoot, "feature/unmerged")).rejects.toThrow(/not fully merged|unmerged/i);
  });
});

describe("deleteRemoteBranch", () => {
  it("rejects deleting the protected origin/main branch", async () => {
    const { repoRoot } = createTrackedRepo();

    await expect(deleteRemoteBranch(repoRoot, "origin", "main")).rejects.toThrow(/protected remote branch/i);
  });

  it("deletes a remote branch and prunes the local tracking ref", async () => {
    const { remoteRoot, repoRoot } = createTrackedRepo();
    const peerRoot = makeTempDir("diff-worktree-peer-");
    cloneRemote(remoteRoot, peerRoot);
    runGit(peerRoot, ["checkout", "-b", "feature/remote-delete"]);
    commitFile(peerRoot, "remote-delete.txt", "bye\n", "feat: remote delete");
    runGit(peerRoot, ["push", "-u", "origin", "feature/remote-delete"]);
    runGit(repoRoot, ["fetch", "origin"]);

    await expect(deleteRemoteBranch(repoRoot, "origin", "feature/remote-delete")).resolves.toBeUndefined();

    expect(runGit(repoRoot, ["branch", "-r", "--list", "origin/feature/remote-delete"])).toBe("");
    expect(runGit(remoteRoot, ["for-each-ref", "--format=%(refname:short)", "refs/heads/feature/remote-delete"])).toBe(
      "",
    );
  });
});

describe("updateLocalBranch", () => {
  it("fast-forwards a behind current branch from its upstream", async () => {
    const { remoteRoot, repoRoot } = createTrackedRepo();
    const peerRoot = makeTempDir("diff-worktree-peer-");
    cloneRemote(remoteRoot, peerRoot);
    commitFile(peerRoot, "behind.txt", "behind\n", "feat: remote change");
    runGit(peerRoot, ["push", "origin", "main"]);

    await expect(updateLocalBranch(repoRoot, "main")).resolves.toBeUndefined();

    const mainBranch = (await listBranches(repoRoot)).localBranches.find((branch) => branch.name === "main");
    expect(mainBranch).toMatchObject({
      ahead: 0,
      behind: 0,
      syncStatus: "upToDate",
    });
    expect(fs.readFileSync(path.join(repoRoot, "behind.txt"), "utf8")).toBe("behind\n");
  });

  it("rejects updating a diverged branch", async () => {
    const { remoteRoot, repoRoot } = createTrackedRepo();
    const peerRoot = makeTempDir("diff-worktree-peer-");
    cloneRemote(remoteRoot, peerRoot);
    commitFile(repoRoot, "local.txt", "local\n", "feat: local change");
    commitFile(peerRoot, "remote.txt", "remote\n", "feat: remote change");
    runGit(peerRoot, ["push", "origin", "main"]);
    runGit(repoRoot, ["fetch", "origin"]);

    await expect(updateLocalBranch(repoRoot, "main")).rejects.toThrow(/manual|rebase|merge/i);
  });
});

describe("getRepoSummary", () => {
  it("returns the current branch and repo metadata", async () => {
    const { repoRoot } = createTrackedRepo();

    await expect(getRepoSummary(repoRoot)).resolves.toMatchObject({
      repoRoot,
      currentBranch: "main",
      defaultSelectedBranch: "main",
      branchPollIntervalMs: 60000,
    });
  });
});

describe("useRemoteVersion", () => {
  it("removes an untracked file when it does not exist on the base branch", async () => {
    const { repoRoot } = createTrackedRepo();
    const addedFile = path.join(repoRoot, "111.md");
    fs.writeFileSync(addedFile, "local draft\n");

    await expect(useRemoteVersion(repoRoot, "main", "111.md")).resolves.toBeUndefined();

    expect(fs.existsSync(addedFile)).toBe(false);
    expect(runGit(repoRoot, ["status", "--short"])).toBe("");
  });
});

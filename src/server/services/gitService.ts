import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { BranchLists, BranchStatus, RepoSummary, SyncStatus } from "../../shared/types";

const execFileAsync = promisify(execFile);

export const BRANCH_POLL_INTERVAL_MS = 60_000;

async function runGit(repoRoot: string, args: string[]) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: repoRoot,
  });

  return stdout.trim();
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const stderr = "stderr" in error ? error.stderr : undefined;
    if (typeof stderr === "string" && stderr.trim()) {
      return stderr.trim();
    }

    const message = "message" in error ? error.message : undefined;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return fallback;
}

async function tryRunGit(repoRoot: string, args: string[]) {
  try {
    return await runGit(repoRoot, args);
  } catch {
    return null;
  }
}

function getSyncStatus(upstreamName: string | undefined, ahead: number, behind: number): SyncStatus {
  if (!upstreamName) {
    return "noUpstream";
  }

  if (ahead > 0 && behind > 0) {
    return "diverged";
  }

  if (ahead > 0) {
    return "ahead";
  }

  if (behind > 0) {
    return "behind";
  }

  return "upToDate";
}

export async function getCurrentBranch(repoRoot: string) {
  return runGit(repoRoot, ["branch", "--show-current"]);
}

export async function getRepoSummary(repoRoot: string): Promise<RepoSummary> {
  const currentBranch = await getCurrentBranch(repoRoot);

  return {
    repoRoot,
    homeDir: os.homedir(),
    currentBranch,
    defaultSelectedBranch: currentBranch,
    branchPollIntervalMs: BRANCH_POLL_INTERVAL_MS,
  };
}

export async function fetchRemotes(repoRoot: string): Promise<void> {
  try {
    await runGit(repoRoot, ["fetch", "--all", "--prune"]);
  } catch (error) {
    throw new Error(getErrorMessage(error, "Failed to fetch remote branches."));
  }
}

function getUpdateDisabledReason(upstreamName: string | undefined, ahead: number, behind: number): string {
  if (!upstreamName) {
    return "No upstream configured.";
  }

  if (ahead > 0 && behind > 0) {
    return "Requires manual rebase or merge.";
  }

  if (ahead > 0) {
    return "Branch has local commits. Update it manually.";
  }

  if (behind === 0) {
    return "Already up to date.";
  }

  return "";
}

async function getLocalBranchStatus(
  repoRoot: string,
  currentBranch: string,
  line: string,
): Promise<BranchStatus> {
  const [name, upstreamValue, lastCommitOid, lastCommitMessage, lastCommitAuthorDate] = line.split("\t");
  const upstreamCandidate = upstreamValue || undefined;

  let ahead = 0;
  let behind = 0;
  let upstreamName = upstreamCandidate;

  if (upstreamCandidate) {
    const upstreamExists = await tryRunGit(repoRoot, ["rev-parse", "--verify", "--quiet", upstreamCandidate]);
    if (!upstreamExists) {
      upstreamName = undefined;
    }
  }

  if (upstreamName) {
    const counts = await runGit(repoRoot, ["rev-list", "--left-right", "--count", `${name}...${upstreamName}`]);
    const [aheadValue, behindValue] = counts.split(/\s+/);
    ahead = Number.parseInt(aheadValue, 10);
    behind = Number.parseInt(behindValue, 10);
  }

  const disabledReason = getUpdateDisabledReason(upstreamName, ahead, behind);

  return {
    scope: "local",
    name,
    displayName: name,
    isCurrent: name === currentBranch,
    upstreamName,
    ahead,
    behind,
    syncStatus: getSyncStatus(upstreamName, ahead, behind),
    lastCommitOid,
    lastCommitMessage,
    lastCommitAuthorDate,
    canDelete: name !== currentBranch,
    canUpdate: disabledReason === "",
    disabledReason: disabledReason || (name === currentBranch ? "Current branch cannot be deleted." : undefined),
  };
}

export async function listLocalBranches(repoRoot: string): Promise<BranchStatus[]> {
  const currentBranch = await getCurrentBranch(repoRoot);
  const output = await runGit(repoRoot, [
    "for-each-ref",
    "--sort=-committerdate",
    "--format=%(refname:short)\t%(upstream:short)\t%(objectname)\t%(contents:subject)\t%(committerdate:iso-strict)",
    "refs/heads",
  ]);

  const lines = output ? output.split("\n") : [];

  return Promise.all(
    lines.map((line) => getLocalBranchStatus(repoRoot, currentBranch, line)),
  );
}

export async function listRemoteBranches(repoRoot: string): Promise<BranchStatus[]> {
  const output = await runGit(repoRoot, [
    "for-each-ref",
    "--sort=-committerdate",
    "--format=%(refname:short)\t%(objectname)\t%(contents:subject)\t%(committerdate:iso-strict)\t%(symref)",
    "refs/remotes",
  ]);

  const lines = output ? output.split("\n") : [];

  return lines
    .map((line) => {
      const [name, lastCommitOid, lastCommitMessage, lastCommitAuthorDate, symref] = line.split("\t");
      if (symref || name.endsWith("/HEAD")) {
        return null;
      }

      const slashIndex = name.indexOf("/");
      const remoteName = slashIndex === -1 ? undefined : name.slice(0, slashIndex);
      const shortName = slashIndex === -1 ? name : name.slice(slashIndex + 1);
      const isProtectedRemoteMain = remoteName === "origin" && shortName === "main";

      return {
        scope: "remote" as const,
        name,
        displayName: shortName,
        remoteName,
        shortName,
        isCurrent: false,
        ahead: 0,
        behind: 0,
        syncStatus: "upToDate" as const,
        lastCommitOid,
        lastCommitMessage,
        lastCommitAuthorDate,
        canDelete: !isProtectedRemoteMain,
        canUpdate: false,
        disabledReason: isProtectedRemoteMain ? "Protected remote branch." : undefined,
      };
    })
    .filter((branch): branch is BranchStatus => branch !== null);
}

export async function listBranches(repoRoot: string): Promise<BranchLists> {
  const [localBranches, remoteBranches] = await Promise.all([
    listLocalBranches(repoRoot),
    listRemoteBranches(repoRoot),
  ]);

  return {
    localBranches,
    remoteBranches,
  };
}

async function getBranchUpstreamConfig(repoRoot: string, branchName: string) {
  const remoteName = await tryRunGit(repoRoot, ["config", `branch.${branchName}.remote`]);
  const mergeRef = await tryRunGit(repoRoot, ["config", `branch.${branchName}.merge`]);

  if (!remoteName || !mergeRef) {
    throw new Error(`Branch ${branchName} has no upstream configured.`);
  }

  const shortName = mergeRef.startsWith("refs/heads/") ? mergeRef.slice("refs/heads/".length) : mergeRef;

  return {
    remoteName,
    mergeRef,
    shortName,
  };
}

export async function updateLocalBranch(repoRoot: string, branchName: string): Promise<void> {
  const currentBranch = await getCurrentBranch(repoRoot);
  const { remoteName, mergeRef, shortName } = await getBranchUpstreamConfig(repoRoot, branchName);

  try {
    await runGit(repoRoot, ["fetch", remoteName, shortName]);

    const branches = await listLocalBranches(repoRoot);
    const branch = branches.find((item) => item.name === branchName);

    if (!branch) {
      throw new Error(`Local branch ${branchName} was not found.`);
    }

    if (!branch.canUpdate) {
      throw new Error(branch.disabledReason ?? `Branch ${branchName} requires manual update.`);
    }

    if (branchName === currentBranch) {
      await runGit(repoRoot, ["merge", "--ff-only", "FETCH_HEAD"]);
      return;
    }

    await runGit(repoRoot, ["fetch", remoteName, `${mergeRef}:refs/heads/${branchName}`]);
  } catch (error) {
    throw new Error(getErrorMessage(error, `Failed to update local branch ${branchName}.`));
  }
}

export async function deleteLocalBranch(repoRoot: string, branchName: string): Promise<void> {
  const currentBranch = await getCurrentBranch(repoRoot);
  if (branchName === currentBranch) {
    throw new Error("Cannot delete the current branch.");
  }

  try {
    await runGit(repoRoot, ["branch", "-d", branchName]);
  } catch (error) {
    throw new Error(getErrorMessage(error, `Failed to delete local branch ${branchName}.`));
  }
}

export async function deleteRemoteBranch(repoRoot: string, remoteName: string, branchName: string): Promise<void> {
  if (remoteName === "origin" && branchName === "main") {
    throw new Error("Protected remote branch.");
  }

  try {
    await runGit(repoRoot, ["push", remoteName, "--delete", branchName]);
    await tryRunGit(repoRoot, ["branch", "-dr", `${remoteName}/${branchName}`]);
  } catch (error) {
    throw new Error(getErrorMessage(error, `Failed to delete remote branch ${remoteName}/${branchName}.`));
  }
}

async function runGitBuffer(repoRoot: string, args: string[]) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: repoRoot,
    encoding: "buffer",
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

export async function useRemoteVersion(repoRoot: string, baseBranch: string, filePath: string): Promise<void> {
  const resolvedRoot = path.resolve(repoRoot);
  const resolvedPath = path.resolve(resolvedRoot, filePath);
  const relativeToRoot = path.relative(resolvedRoot, resolvedPath);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error(`Path ${filePath} is outside the repository root.`);
  }

  let buffer: Buffer;

  try {
    buffer = await runGitBuffer(repoRoot, ["show", `${baseBranch}:${filePath}`]);
  } catch {
    await fs.promises.rm(resolvedPath, { force: true });
    await runGit(repoRoot, ["rm", "--cached", "--ignore-unmatch", "--quiet", "--", filePath]);
    return;
  }
  await fs.promises.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.promises.writeFile(resolvedPath, buffer);
  await runGit(repoRoot, ["add", filePath]);
}

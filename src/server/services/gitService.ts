import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { BranchStatus, RepoSummary, SyncStatus } from "../../shared/types";

const execFileAsync = promisify(execFile);

export const BRANCH_POLL_INTERVAL_MS = 60_000;

async function runGit(repoRoot: string, args: string[]) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: repoRoot,
  });

  return stdout.trim();
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
    lines.map(async (line) => {
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

      return {
        name,
        isCurrent: name === currentBranch,
        upstreamName,
        ahead,
        behind,
        syncStatus: getSyncStatus(upstreamName, ahead, behind),
        lastCommitOid,
        lastCommitMessage,
        lastCommitAuthorDate,
      };
    }),
  );
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

  const buffer = await runGitBuffer(repoRoot, ["show", `${baseBranch}:${filePath}`]);
  await fs.promises.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.promises.writeFile(resolvedPath, buffer);
  await runGit(repoRoot, ["add", filePath]);
}

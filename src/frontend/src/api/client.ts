import type { BranchStatus, DiffFilePayload, DiffTreeNode, RepoSummary } from "../types";

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getRepoSummary() {
  return requestJson<RepoSummary>("/api/repo/summary");
}

export async function getBranches() {
  const payload = await requestJson<{ branches: BranchStatus[] }>("/api/branches");
  return payload.branches;
}

export async function getDiffTree(baseBranch: string) {
  const payload = await requestJson<{ tree: DiffTreeNode[] }>(
    `/api/diff-tree?baseBranch=${encodeURIComponent(baseBranch)}`,
  );
  return payload.tree;
}

export function getDiffFile(baseBranch: string, filePath: string) {
  return requestJson<DiffFilePayload>(
    `/api/diff-file?baseBranch=${encodeURIComponent(baseBranch)}&path=${encodeURIComponent(filePath)}`,
  );
}

export function saveWorkspaceFile(path: string, content: string) {
  return requestJson<{ path: string; saved: true }>("/api/workspace-file", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
}

export function refreshRepo() {
  return requestJson<{ branches: BranchStatus[] }>("/api/refresh", {
    method: "POST",
  });
}

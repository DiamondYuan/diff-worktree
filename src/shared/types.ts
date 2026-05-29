export type SyncStatus =
  | "upToDate"
  | "ahead"
  | "behind"
  | "diverged"
  | "noUpstream";

export interface RepoSummary {
  repoRoot: string;
  homeDir: string;
  currentBranch: string;
  defaultSelectedBranch: string;
  branchPollIntervalMs: number;
}

export interface BranchStatus {
  name: string;
  displayName?: string;
  isCurrent: boolean;
  upstreamName?: string;
  ahead: number;
  behind: number;
  syncStatus: SyncStatus;
  lastCommitOid: string;
  lastCommitMessage: string;
  lastCommitAuthorDate: string;
  canDelete?: boolean;
  canUpdate?: boolean;
  disabledReason?: string;
}

export type ChangeType = "added" | "modified" | "deleted" | "renamed";

export interface DiffTreeNode {
  path: string;
  name: string;
  type: "file" | "directory";
  changeType?: ChangeType;
  oldPath?: string;
  children?: DiffTreeNode[];
  stats?: {
    additions: number;
    deletions: number;
  };
  // md5 over (repoRoot, path, base content, workspace content); only on files.
  reviewHash?: string;
  // True when reviewHash matches the locally persisted reviewed hash.
  reviewed?: boolean;
}

export interface DiffFilePayload {
  path: string;
  changeType: ChangeType;
  oldPath?: string;
  language: string;
  left: string;
  right: string;
  isBinary: boolean;
  tooLarge: boolean;
}

import { useEffect, useRef, useState } from "react";

import {
  deleteLocalBranch,
  deleteRemoteBranch,
  getBranches,
  getDiffFile,
  getDiffTree,
  getRepoSummary,
  refreshRepo,
  saveWorkspaceFile,
  updateLocalBranch,
  useRemoteVersion,
} from "./api/client";
import { BranchPane } from "./components/BranchPane";
import { DiffTreePane } from "./components/DiffTreePane";
import { DiffViewerPane } from "./components/DiffViewerPane";
import type { BranchLists, BranchStatus, DiffFilePayload, DiffTreeNode, RepoSummary } from "./types";

const SESSION_SELECTED_BRANCH_KEY = "diff-worktree:selected-branch";
const SESSION_SELECTED_FILE_KEY = "diff-worktree:selected-file";

function readSessionValue(key: string): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.sessionStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeSessionValue(key: string, value: string | undefined) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (value) {
      window.sessionStorage.setItem(key, value);
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore session storage failures and keep the app functional.
  }
}

function findFirstFile(nodes: DiffTreeNode[]): string | undefined {
  for (const node of nodes) {
    if (node.type === "file") {
      return node.path;
    }

    const nested = findFirstFile(node.children ?? []);
    if (nested) {
      return nested;
    }
  }

  return undefined;
}

function hasFile(nodes: DiffTreeNode[], targetPath: string | undefined): boolean {
  if (!targetPath) {
    return false;
  }

  for (const node of nodes) {
    if (node.type === "file" && node.path === targetPath) {
      return true;
    }

    if (node.type === "directory" && hasFile(node.children ?? [], targetPath)) {
      return true;
    }
  }

  return false;
}

function hasNode(nodes: DiffTreeNode[], targetPath: string | undefined): boolean {
  if (!targetPath) {
    return false;
  }

  for (const node of nodes) {
    if (node.path === targetPath) {
      return true;
    }

    if (node.type === "directory" && hasNode(node.children ?? [], targetPath)) {
      return true;
    }
  }

  return false;
}

export function App() {
  const [summary, setSummary] = useState<RepoSummary | null>(null);
  const [localBranches, setLocalBranches] = useState<BranchStatus[]>([]);
  const [remoteBranches, setRemoteBranches] = useState<BranchStatus[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | undefined>(() => readSessionValue(SESSION_SELECTED_BRANCH_KEY));
  const [diffTree, setDiffTree] = useState<DiffTreeNode[]>([]);
  const [selectedTreePath, setSelectedTreePath] = useState<string>();
  const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>(() => readSessionValue(SESSION_SELECTED_FILE_KEY));
  const [diffFile, setDiffFile] = useState<DiffFilePayload | null>(null);
  const [error, setError] = useState<string>();
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [treeLoading, setTreeLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [treeReloadNonce, setTreeReloadNonce] = useState(0);
  const [diffReloadNonce, setDiffReloadNonce] = useState(0);
  const [draftContent, setDraftContent] = useState("");
  const [persistedContent, setPersistedContent] = useState("");
  const [draftVersion, setDraftVersion] = useState(0);

  const selectedBranchRef = useRef<string | undefined>(undefined);
  const selectedFilePathRef = useRef<string | undefined>(undefined);
  const draftContentRef = useRef("");
  const persistedContentRef = useRef("");
  const draftVersionRef = useRef(0);

  selectedBranchRef.current = selectedBranch;
  selectedFilePathRef.current = selectedFilePath;
  draftContentRef.current = draftContent;
  persistedContentRef.current = persistedContent;
  draftVersionRef.current = draftVersion;

  function applyBranchLists(branchLists: BranchLists) {
    setLocalBranches(branchLists.localBranches);
    setRemoteBranches(branchLists.remoteBranches);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      try {
        const repoSummary = await getRepoSummary();
        if (cancelled) {
          return;
        }

        setSummary(repoSummary);
        setSelectedBranch((current) => current ?? repoSummary.defaultSelectedBranch);
        setError(undefined);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load repository summary.");
        }
      }
    }

    void loadInitial();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBranches() {
      setBranchesLoading(true);

      try {
        const branchLists = await getBranches();
        if (!cancelled) {
          applyBranchLists(branchLists);
          setError(undefined);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load branches.");
        }
      } finally {
        if (!cancelled) {
          setBranchesLoading(false);
        }
      }
    }

    void loadBranches();
    const timer = window.setInterval(() => {
      void loadBranches();
    }, summary?.branchPollIntervalMs ?? 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [summary?.branchPollIntervalMs, refreshNonce]);

  useEffect(() => {
    if (branchesLoading || localBranches.length === 0) {
      return;
    }

    if (selectedBranch && localBranches.some((branch) => branch.name === selectedBranch)) {
      return;
    }

    const fallbackBranch =
      localBranches.find((branch) => branch.name === summary?.defaultSelectedBranch)?.name ?? localBranches[0]?.name;

    if (fallbackBranch && fallbackBranch !== selectedBranch) {
      setSelectedBranch(fallbackBranch);
    }
  }, [localBranches, branchesLoading, selectedBranch, summary?.defaultSelectedBranch]);

  useEffect(() => {
    writeSessionValue(SESSION_SELECTED_BRANCH_KEY, selectedBranch);
  }, [selectedBranch]);

  useEffect(() => {
    writeSessionValue(SESSION_SELECTED_FILE_KEY, selectedFilePath);
  }, [selectedFilePath]);

  useEffect(() => {
    if (!selectedBranch || branchesLoading) {
      return;
    }

    const activeBranch = selectedBranch;
    let cancelled = false;

    async function loadTree() {
      setTreeLoading(true);
      setDiffFile(null);

      try {
        const nextTree = await getDiffTree(activeBranch);
        if (cancelled) {
          return;
        }

        setDiffTree(nextTree);
        const nextSelectedFilePath = hasFile(nextTree, selectedFilePath)
          ? selectedFilePath
          : findFirstFile(nextTree);
        const nextSelectedTreePath = hasNode(nextTree, selectedTreePath)
          ? selectedTreePath
          : nextSelectedFilePath;
        setSelectedTreePath(nextSelectedTreePath);
        setSelectedFilePath(nextSelectedFilePath);
        if (nextSelectedFilePath && nextSelectedFilePath === selectedFilePath) {
          setDiffReloadNonce((current) => current + 1);
        }
        setError(undefined);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load diff tree.");
        }
      } finally {
        if (!cancelled) {
          setTreeLoading(false);
        }
      }
    }

    void loadTree();

    return () => {
      cancelled = true;
    };
  }, [branchesLoading, selectedBranch, refreshNonce, treeReloadNonce]);

  useEffect(() => {
    if (!selectedBranch || !selectedFilePath) {
      setDiffFile(null);
      setDraftContent("");
      setPersistedContent("");
      return;
    }

    const activeBranch = selectedBranch;
    const activeFilePath = selectedFilePath;
    let cancelled = false;

    setDiffFile(null);
    setDraftContent("");
    setPersistedContent("");

    async function loadDiff() {
      setDiffLoading(true);

      try {
        const payload = await getDiffFile(activeBranch, activeFilePath);
        if (!cancelled) {
          setDiffFile(payload);
          const hasNewerLocalDraft =
            selectedBranchRef.current === activeBranch &&
            selectedFilePathRef.current === activeFilePath &&
            draftContentRef.current !== persistedContentRef.current;
          if (!hasNewerLocalDraft) {
            setDraftContent(payload.right);
            setPersistedContent(payload.right);
          }
          setError(undefined);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load diff file.");
        }
      } finally {
        if (!cancelled) {
          setDiffLoading(false);
        }
      }
    }

    void loadDiff();

    return () => {
      cancelled = true;
    };
  }, [selectedBranch, selectedFilePath, diffReloadNonce]);

  useEffect(() => {
    if (!selectedBranch || !selectedFilePath || draftContent === persistedContent) {
      return;
    }

    const activeBranch = selectedBranch;
    const activeFilePath = selectedFilePath;
    const activeDraftVersion = draftVersion;
    const activeDraftContent = draftContent;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await saveWorkspaceFile(activeFilePath, activeDraftContent);
          if (
            selectedBranchRef.current !== activeBranch ||
            selectedFilePathRef.current !== activeFilePath ||
            draftVersionRef.current !== activeDraftVersion
          ) {
            return;
          }

          setPersistedContent(activeDraftContent);
          setError(undefined);
        } catch (saveError) {
          if (
            selectedBranchRef.current !== activeBranch ||
            selectedFilePathRef.current !== activeFilePath ||
            draftVersionRef.current !== activeDraftVersion
          ) {
            return;
          }

          setError(saveError instanceof Error ? saveError.message : "Failed to save workspace file.");
        }
      })();
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [draftContent, draftVersion, persistedContent, selectedBranch, selectedFilePath]);

  async function handleRefresh() {
    setRefreshing(true);

    try {
      applyBranchLists(await refreshRepo());
      setRefreshNonce((current) => current + 1);
      setError(undefined);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Failed to refresh repository state.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleUseRemote(filePath: string) {
    if (!selectedBranch) {
      return;
    }

    try {
      await useRemoteVersion(selectedBranch, filePath);
      setTreeReloadNonce((current) => current + 1);
      setDiffReloadNonce((current) => current + 1);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to use remote version.");
    }
  }

  async function handleUpdateLocalBranch(branchName: string) {
    try {
      applyBranchLists(await updateLocalBranch(branchName));
      setTreeReloadNonce((current) => current + 1);
      setDiffReloadNonce((current) => current + 1);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update branch.");
    }
  }

  async function handleDeleteLocalBranch(branchName: string) {
    if (!window.confirm(`Delete local branch ${branchName}?`)) {
      return;
    }

    try {
      applyBranchLists(await deleteLocalBranch(branchName));
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete local branch.");
    }
  }

  async function handleDeleteRemoteBranch(remoteName: string, branchName: string, fullName: string) {
    if (!window.confirm(`Delete remote branch ${fullName}?`)) {
      return;
    }

    try {
      applyBranchLists(await deleteRemoteBranch(remoteName, branchName));
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete remote branch.");
    }
  }

  function handleSelectTreeItem(node: DiffTreeNode) {
    setSelectedTreePath(node.path);

    if (node.type === "file") {
      setSelectedFilePath(node.path);
    }
  }

  function handleDraftChange(next: string) {
    setDraftContent(next);
    setDraftVersion((current) => current + 1);
  }

  return (
    <main className="app-shell">
      <BranchPane
        localBranches={localBranches}
        remoteBranches={remoteBranches}
        homeDir={summary?.homeDir}
        loading={branchesLoading}
        onDeleteLocalBranch={handleDeleteLocalBranch}
        onDeleteRemoteBranch={handleDeleteRemoteBranch}
        onRefresh={handleRefresh}
        onSelectBranch={setSelectedBranch}
        onUpdateLocalBranch={handleUpdateLocalBranch}
        refreshing={refreshing}
        repoRoot={summary?.repoRoot}
        selectedBranch={selectedBranch}
      />
      <DiffTreePane
        loading={treeLoading}
        nodes={diffTree}
        onSelectFile={setSelectedFilePath}
        onSelectItem={handleSelectTreeItem}
        onUseRemote={handleUseRemote}
        selectedBranch={selectedBranch}
        selectedPath={selectedTreePath}
        selectedFilePath={selectedFilePath}
      />
      <DiffViewerPane
        diffFile={diffFile}
        draftContent={draftContent}
        loading={diffLoading}
        onDraftChange={handleDraftChange}
        selectedBranch={selectedBranch}
      />
      {error ? <div className="global-error">{error}</div> : null}
    </main>
  );
}

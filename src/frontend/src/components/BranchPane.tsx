import { useState } from "react";
import type { BranchStatus } from "./../types";
import { ChevronRight, RefreshCw, Trash2 } from "lucide-react";

import { formatDisplayPath } from "../utils/displayPath";

interface BranchPaneProps {
  localBranches: BranchStatus[];
  remoteBranches: BranchStatus[];
  homeDir?: string;
  loading: boolean;
  refreshing: boolean;
  repoRoot?: string;
  selectedBranch?: string;
  onSelectBranch: (branchName: string) => void;
  onRefresh: () => void;
  onUpdateLocalBranch: (branchName: string) => void;
  onDeleteLocalBranch: (branchName: string) => void;
  onDeleteRemoteBranch: (remoteName: string, branchName: string, fullName: string) => void;
}

interface BranchGroup {
  prefix: string | null;
  branches: BranchStatus[];
  newestDate: string;
}

function groupBranches(branches: BranchStatus[]): BranchGroup[] {
  const groupMap = new Map<string | null, BranchStatus[]>();
  const groupOrder: (string | null)[] = [];

  for (const branch of branches) {
    const slashIndex = branch.name.indexOf("/");
    const prefix = slashIndex !== -1 ? branch.name.slice(0, slashIndex) : null;

    if (!groupMap.has(prefix)) {
      groupMap.set(prefix, []);
      groupOrder.push(prefix);
    }
    groupMap.get(prefix)!.push(branch);
  }

  const groups: BranchGroup[] = groupOrder.map((prefix) => {
    const groupBranches = groupMap.get(prefix)!;
    return {
      prefix,
      branches: groupBranches,
      newestDate: groupBranches[0].lastCommitAuthorDate,
    };
  });

  groups.sort((a, b) => {
    if (a.newestDate > b.newestDate) return -1;
    if (a.newestDate < b.newestDate) return 1;
    return 0;
  });

  return groups;
}

function renderSyncStatus(branch: BranchStatus) {
  switch (branch.syncStatus) {
    case "upToDate":
      return "up to date";
    case "ahead":
      return `ahead ${branch.ahead}`;
    case "behind":
      return `behind ${branch.behind}`;
    case "diverged":
      return `ahead ${branch.ahead} / behind ${branch.behind}`;
    case "noUpstream":
      return "no upstream";
  }
}

function shouldShowLocalUpdateAction(branch: BranchStatus) {
  if (branch.syncStatus === "upToDate" || branch.syncStatus === "noUpstream") {
    return false;
  }

  return Boolean(branch.canUpdate || branch.disabledReason);
}

function isProtectedRemoteMain(branch: BranchStatus) {
  return branch.scope === "remote" && branch.remoteName === "origin" && branch.shortName === "main";
}

function shouldShowRemoteDeleteAction(branch: BranchStatus) {
  return !isProtectedRemoteMain(branch);
}

function LocalBranchItem({
  branch,
  selected,
  displayName,
  onSelect,
  onUpdate,
  onDelete,
}: {
  branch: BranchStatus;
  selected: boolean;
  displayName: string;
  onSelect: () => void;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`branch-row${selected ? " branch-row-selected" : ""}`}>
      <button
        className={`branch-item${selected ? " branch-item-selected" : ""}`}
        onClick={onSelect}
        title={branch.name}
        type="button"
      >
        <div className="branch-item-title">
          <span className="branch-item-name">{displayName}</span>
          {branch.isCurrent ? <span className="pill pill-current">current</span> : null}
        </div>
        <div className="branch-item-meta">{renderSyncStatus(branch)}</div>
      </button>
      <div className="branch-item-actions">
        {shouldShowLocalUpdateAction(branch) ? (
          <button
            aria-label={`Update ${branch.name}`}
            className="ghost-button ghost-button-icon ghost-button-plain branch-action-button"
            disabled={!branch.canUpdate}
            onClick={onUpdate}
            title={branch.canUpdate ? "Update branch" : branch.disabledReason}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={14} strokeWidth={1.8} />
          </button>
        ) : null}
        <button
          aria-label={`Delete ${branch.name}`}
          className="ghost-button ghost-button-icon ghost-button-plain branch-action-button"
          disabled={!branch.canDelete}
          onClick={onDelete}
          title={branch.canDelete ? "Delete branch" : branch.disabledReason ?? "Branch cannot be deleted."}
          type="button"
        >
          <Trash2 aria-hidden="true" size={14} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}

function RemoteBranchItem({
  branch,
  onDelete,
}: {
  branch: BranchStatus;
  onDelete: () => void;
}) {
  return (
    <div className="branch-row">
      <div className="branch-item branch-item-static" title={branch.name}>
        <div className="branch-item-title">
          <span className="branch-item-name">{branch.displayName ?? branch.shortName ?? branch.name}</span>
        </div>
        <div className="branch-item-meta branch-item-subtitle">{branch.name}</div>
      </div>
      <div className="branch-item-actions">
        {shouldShowRemoteDeleteAction(branch) ? (
          <button
            aria-label={`Delete ${branch.name}`}
            className="ghost-button ghost-button-icon ghost-button-plain branch-action-button"
            disabled={!branch.canDelete}
            onClick={onDelete}
            title={branch.canDelete ? "Delete remote branch" : branch.disabledReason}
            type="button"
          >
            <Trash2 aria-hidden="true" size={14} strokeWidth={1.8} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function BranchPane({
  localBranches,
  remoteBranches,
  homeDir,
  loading,
  refreshing,
  repoRoot,
  selectedBranch,
  onSelectBranch,
  onRefresh,
  onUpdateLocalBranch,
  onDeleteLocalBranch,
  onDeleteRemoteBranch,
}: BranchPaneProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const groups = groupBranches(localBranches);

  function toggleGroup(prefix: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(prefix)) {
        next.delete(prefix);
      } else {
        next.add(prefix);
      }
      return next;
    });
  }

  return (
    <section className="pane">
      <header className="pane-header">
        <span>Branches</span>
        <div className="pane-actions">
          <button
            aria-label={refreshing ? "Refreshing" : "Refresh"}
            className={`ghost-button ghost-button-icon ghost-button-plain${refreshing ? " ghost-button-spinning" : ""}`}
            disabled={loading || refreshing}
            onClick={onRefresh}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={14} strokeWidth={1.8} />
          </button>
        </div>
      </header>
      <div className="pane-body">
        <div className="repo-root">{repoRoot ? formatDisplayPath(repoRoot, homeDir) : "Loading repository..."}</div>
        {loading ? <div className="empty-state">Loading branches...</div> : null}
        <section className="branch-section">
          <div className="branch-section-title">Local branches</div>
          <div className="branch-list">
            {groups.map((group) => {
              if (group.prefix === null) {
                return group.branches.map((branch) => (
                  <LocalBranchItem
                    key={branch.name}
                    branch={branch}
                    displayName={branch.name}
                    selected={selectedBranch === branch.name}
                    onDelete={() => onDeleteLocalBranch(branch.name)}
                    onSelect={() => onSelectBranch(branch.name)}
                    onUpdate={() => onUpdateLocalBranch(branch.name)}
                  />
                ));
              }

              const collapsed = collapsedGroups.has(group.prefix);

              return (
                <div key={group.prefix} className="branch-group">
                  <button
                    className="branch-group-header"
                    onClick={() => toggleGroup(group.prefix!)}
                    type="button"
                  >
                    <ChevronRight
                      className={`branch-group-chevron${collapsed ? "" : " branch-group-chevron-open"}`}
                      size={12}
                      strokeWidth={1.8}
                    />
                    <span>{group.prefix}/</span>
                    <span className="branch-group-count">{group.branches.length}</span>
                  </button>
                  {!collapsed
                    ? group.branches.map((branch) => (
                        <LocalBranchItem
                          key={branch.name}
                          branch={branch}
                          displayName={branch.name.slice(group.prefix!.length + 1)}
                          selected={selectedBranch === branch.name}
                          onDelete={() => onDeleteLocalBranch(branch.name)}
                          onSelect={() => onSelectBranch(branch.name)}
                          onUpdate={() => onUpdateLocalBranch(branch.name)}
                        />
                      ))
                    : null}
                </div>
              );
            })}
          </div>
        </section>
        <section className="branch-section">
          <div className="branch-section-title">Remote branches</div>
          <div className="branch-list">
            {remoteBranches.map((branch) => (
              <RemoteBranchItem
                key={branch.name}
                branch={branch}
                onDelete={() =>
                  onDeleteRemoteBranch(
                    branch.remoteName ?? "origin",
                    branch.shortName ?? branch.displayName ?? branch.name,
                    branch.name,
                  )
                }
              />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

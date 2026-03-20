import { useState } from "react";
import type { BranchStatus } from "./../types";
import { ChevronRight, RefreshCw } from "lucide-react";

import { formatDisplayPath } from "../utils/displayPath";

interface BranchPaneProps {
  branches: BranchStatus[];
  homeDir?: string;
  loading: boolean;
  refreshing: boolean;
  repoRoot?: string;
  selectedBranch?: string;
  onSelectBranch: (branchName: string) => void;
  onRefresh: () => void;
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

function BranchItem({
  branch,
  selected,
  displayName,
  onSelect,
}: {
  branch: BranchStatus;
  selected: boolean;
  displayName: string;
  onSelect: () => void;
}) {
  return (
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
  );
}

export function BranchPane({
  branches,
  homeDir,
  loading,
  refreshing,
  repoRoot,
  selectedBranch,
  onSelectBranch,
  onRefresh,
}: BranchPaneProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const groups = groupBranches(branches);

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
        <div className="branch-list">
          {groups.map((group) => {
            if (group.prefix === null) {
              return group.branches.map((branch) => (
                <BranchItem
                  key={branch.name}
                  branch={branch}
                  displayName={branch.name}
                  selected={selectedBranch === branch.name}
                  onSelect={() => onSelectBranch(branch.name)}
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
                      <BranchItem
                        key={branch.name}
                        branch={branch}
                        displayName={branch.name.slice(group.prefix!.length + 1)}
                        selected={selectedBranch === branch.name}
                        onSelect={() => onSelectBranch(branch.name)}
                      />
                    ))
                  : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

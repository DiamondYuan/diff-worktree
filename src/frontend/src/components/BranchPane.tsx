import type { BranchStatus } from "./../types";
import { RefreshCw } from "lucide-react";

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
          {branches.map((branch) => {
            const selected = selectedBranch === branch.name;

            return (
              <button
                key={branch.name}
                className={`branch-item${selected ? " branch-item-selected" : ""}`}
                onClick={() => onSelectBranch(branch.name)}
                type="button"
              >
                <div className="branch-item-title">
                  <span>{branch.name}</span>
                  {branch.isCurrent ? <span className="pill pill-current">current</span> : null}
                </div>
                <div className="branch-item-meta">{renderSyncStatus(branch)}</div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

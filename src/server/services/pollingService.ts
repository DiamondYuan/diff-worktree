import type { BranchStatus } from "../../shared/types";
import { BRANCH_POLL_INTERVAL_MS, listLocalBranches } from "./gitService";

export class BranchPollingService {
  private cache: BranchStatus[] | null = null;

  private refreshPromise: Promise<BranchStatus[]> | null = null;

  constructor(
    private readonly repoRoot: string,
    private readonly intervalMs = BRANCH_POLL_INTERVAL_MS,
  ) {}

  start() {
    void this.refresh();

    const timer = setInterval(() => {
      void this.refresh();
    }, this.intervalMs);

    timer.unref();
  }

  async getBranches() {
    if (this.cache) {
      return this.cache;
    }

    return this.refresh();
  }

  async refresh() {
    if (!this.refreshPromise) {
      this.refreshPromise = listLocalBranches(this.repoRoot)
        .then((branches) => {
          this.cache = branches;
          return branches;
        })
        .finally(() => {
          this.refreshPromise = null;
        });
    }

    return this.refreshPromise;
  }
}

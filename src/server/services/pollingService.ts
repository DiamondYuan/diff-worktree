import type { BranchLists } from "../../shared/types";
import { BRANCH_POLL_INTERVAL_MS, listBranches } from "./gitService";

export class BranchPollingService {
  private cache: BranchLists | null = null;

  private refreshPromise: Promise<BranchLists> | null = null;

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

  async refresh(options?: { syncRemotes?: boolean }) {
    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        if (options?.syncRemotes) {
          const { fetchRemotes } = await import("./gitService");
          await fetchRemotes(this.repoRoot);
        }

        return listBranches(this.repoRoot);
      })()
        .then((branchLists) => {
          this.cache = branchLists;
          return branchLists;
        })
        .finally(() => {
          this.refreshPromise = null;
        });
    }

    return this.refreshPromise;
  }
}

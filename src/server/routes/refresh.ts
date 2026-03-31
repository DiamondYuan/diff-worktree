import type { Express, Request, Response } from "express";

import type { BranchPollingService } from "../services/pollingService";

export function registerRefreshRoute(app: Express, branchPollingService: BranchPollingService) {
  app.post("/api/refresh", async (_req: Request, res: Response) => {
    try {
      const branchLists = await branchPollingService.refresh({ syncRemotes: true });
      res.json(branchLists);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to refresh repository state.",
      });
    }
  });
}

import type { Express, Request, Response } from "express";

import type { BranchPollingService } from "../services/pollingService";

export function registerRefreshRoute(app: Express, branchPollingService: BranchPollingService) {
  app.post("/api/refresh", async (_req: Request, res: Response) => {
    try {
      const branches = await branchPollingService.refresh();
      res.json({ branches });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to refresh repository state.",
      });
    }
  });
}

import type { Express, Request, Response } from "express";

import type { BranchPollingService } from "../services/pollingService";

export function registerBranchesRoute(app: Express, branchPollingService: BranchPollingService) {
  app.get("/api/branches", async (_req: Request, res: Response) => {
    try {
      const branches = await branchPollingService.getBranches();
      res.json({ branches });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to load branches.",
      });
    }
  });
}

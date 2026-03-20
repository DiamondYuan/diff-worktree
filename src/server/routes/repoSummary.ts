import type { Express, Request, Response } from "express";

import { getRepoSummary } from "../services/gitService";

export function registerRepoSummaryRoute(app: Express, repoRoot: string) {
  app.get("/api/repo/summary", async (_req: Request, res: Response) => {
    try {
      const summary = await getRepoSummary(repoRoot);
      res.json(summary);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to load repository summary.",
      });
    }
  });
}

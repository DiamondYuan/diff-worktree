import type { Express, Request, Response } from "express";

import { listDiffTree } from "../services/diffService";

export function registerDiffTreeRoute(app: Express, repoRoot: string) {
  app.get("/api/diff-tree", async (req: Request, res: Response) => {
    const baseBranch = req.query.baseBranch;
    if (typeof baseBranch !== "string" || !baseBranch) {
      res.status(400).json({ error: "Missing baseBranch query parameter." });
      return;
    }

    try {
      const tree = await listDiffTree(repoRoot, baseBranch);
      res.json({ tree });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to load diff tree.",
      });
    }
  });
}

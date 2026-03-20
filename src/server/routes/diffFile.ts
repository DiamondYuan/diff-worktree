import type { Express, Request, Response } from "express";

import { getDiffFile } from "../services/diffService";

export function registerDiffFileRoute(app: Express, repoRoot: string) {
  app.get("/api/diff-file", async (req: Request, res: Response) => {
    const baseBranch = req.query.baseBranch;
    const targetPath = req.query.path;

    if (typeof baseBranch !== "string" || !baseBranch) {
      res.status(400).json({ error: "Missing baseBranch query parameter." });
      return;
    }

    if (typeof targetPath !== "string" || !targetPath) {
      res.status(400).json({ error: "Missing path query parameter." });
      return;
    }

    try {
      const payload = await getDiffFile(repoRoot, baseBranch, targetPath);
      res.json(payload);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to load diff file.",
      });
    }
  });
}

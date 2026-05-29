import type { Express, Request, Response } from "express";

import { clearReviewed, setReviewed } from "../services/reviewService";

export function registerReviewRoute(app: Express, repoRoot: string) {
  app.post("/api/review", (req: Request, res: Response) => {
    const targetPath = req.body?.path;
    const reviewed = req.body?.reviewed;
    const reviewHash = req.body?.reviewHash;

    if (typeof targetPath !== "string" || !targetPath || typeof reviewed !== "boolean") {
      res.status(400).json({ error: "Missing or invalid path/reviewed." });
      return;
    }

    if (reviewed && (typeof reviewHash !== "string" || !reviewHash)) {
      res.status(400).json({ error: "Missing reviewHash for a reviewed file." });
      return;
    }

    try {
      if (reviewed) {
        setReviewed(repoRoot, targetPath, reviewHash);
      } else {
        clearReviewed(repoRoot, targetPath);
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to update review state.",
      });
    }
  });
}

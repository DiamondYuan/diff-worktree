import type { Express, Request, Response } from "express";

import { useRemoteVersion } from "../services/gitService";

export function registerUseRemoteRoute(app: Express, repoRoot: string) {
  app.post("/api/use-remote", async (req: Request, res: Response) => {
    const baseBranch = req.body?.baseBranch;
    const targetPath = req.body?.path;

    if (typeof baseBranch !== "string" || !baseBranch) {
      res.status(400).json({ error: "Missing or invalid baseBranch." });
      return;
    }

    if (typeof targetPath !== "string" || !targetPath) {
      res.status(400).json({ error: "Missing or invalid path." });
      return;
    }

    try {
      await useRemoteVersion(repoRoot, baseBranch, targetPath);
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to use remote version.";
      const status = /outside the repository/i.test(message) ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });
}

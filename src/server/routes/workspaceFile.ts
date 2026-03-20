import type { Express, Request, Response } from "express";

import { writeWorkspaceFile } from "../services/workspaceFileService";

export function registerWorkspaceFileRoute(app: Express, repoRoot: string) {
  app.post("/api/workspace-file", async (req: Request, res: Response) => {
    const targetPath = req.body?.path;
    const content = req.body?.content;

    if (typeof targetPath !== "string" || !targetPath || typeof content !== "string") {
      res.status(400).json({ error: "Missing or invalid path/content." });
      return;
    }

    try {
      const payload = await writeWorkspaceFile(repoRoot, targetPath, content);
      res.json(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save workspace file.";
      const status = /outside the repository/i.test(message) ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });
}
